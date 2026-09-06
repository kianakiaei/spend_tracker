import { STOPWORDS, extractKeys, phraseKeys } from "./keys";
import { canonical } from "./normalize";
import type { SeedCategory } from "./seed-lexicon";

// The pure categorization engine (ticket 21, research 01 §4): a six-rung
// ladder over two in-memory lexicon maps and the user's learned counters.
// Fully injective — the system lexicon, the user's learnedKeys rows and the
// user's categories all arrive as arguments; resolving a lexicon slug to the
// user's category UUID happens HERE from the passed list, while reading
// those rows from SQL is the caller's job (ticket 22). No `next/*` imports.

/** One learned counter — shaped like a `learnedKeys` row (ticket 19), with
 * the userId left outside: the engine is per-user by construction. */
export interface LearnedKeyRecord {
  key: string; // canonical form (normalize.ts)
  categoryId: string;
  // Fractional after decay (×0.5); the engine never prunes, SQL does (ticket 22).
  count: number;
}

/** The user's categories as the engine sees them: opaque ids plus the
 * system-category slug that lexicon keys bind to (ticket 13) — never the
 * (changeable) name. */
export interface UserCategoryRef {
  id: string;
  name: string;
  slug: string | null;
}

/** purity × support of the counters behind a learned hit — reported in the
 * response, never a decision gate (ticket 06: «همیشه پیشنهاد»). */
export interface SuggestionConfidence {
  purity: number;
  support: number;
}

export type SuggestionSource = "learned" | "system";

/** One rung's guess. `null` (no guess at all) is the ladder's last rung. */
export interface Suggestion {
  categoryId: string;
  source: SuggestionSource;
  matchedKey: string;
  confidence: SuggestionConfidence | null;
}

export interface CategorizerInput {
  lexicon: readonly SeedCategory[];
  learnedKeys: readonly LearnedKeyRecord[];
  categories: readonly UserCategoryRef[];
}

export interface Categorizer {
  classify(title: string): Suggestion | null;
}

// key → categoryId → count (research 01 §6's runtime index)
type Counters = Map<string, Map<string, number>>;

// Fuzzy Δ1 (Levenshtein ≤ 1) without allocation — equal strings are excluded
// because exact hits never reach the fuzzy rung.
function withinOneEdit(a: string, b: string): boolean {
  if (a === b || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length === b.length) {
      i++;
      j++;
    } else if (a.length < b.length) {
      j++;
    } else {
      i++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

export function createCategorizer(input: CategorizerInput): Categorizer {
  const { lexicon, learnedKeys, categories } = input;

  // slug → the user's category for it — the code↔category bridge (ticket 13).
  const categoryIdBySlug = new Map<string, string>();
  const categoryOrder = new Map<string, number>();
  categories.forEach((category, index) => {
    categoryOrder.set(category.id, index);
    if (category.slug && !categoryIdBySlug.has(category.slug)) {
      categoryIdBySlug.set(category.slug, category.id);
    }
  });
  const knownCategories = new Set(categories.map((c) => c.id));

  // Learned counters, filtered to live categories and positive counts — a
  // decayed-to-zero or orphaned row must neither suggest nor dilute purity.
  const counters: Counters = new Map();
  for (const row of learnedKeys) {
    if (!knownCategories.has(row.categoryId) || row.count <= 0) continue;
    let perCategory = counters.get(row.key);
    if (!perCategory) {
      perCategory = new Map();
      counters.set(row.key, perCategory);
    }
    perCategory.set(row.categoryId, (perCategory.get(row.categoryId) ?? 0) + row.count);
  }
  // Learned keys split by shape on the way in — multi-word keys land in the
  // phrase map, single words in the token map, so extraction (keys.ts) and
  // lookup stay symmetric. Phrases are never decomposed into tokens.
  const learnedPhrases: Counters = new Map();
  const learnedTokens: Counters = new Map();
  for (const [key, perCategory] of counters) {
    (key.includes(" ") ? learnedPhrases : learnedTokens).set(key, perCategory);
  }

  // Lexicon maps: key → the user's resolved category. Entries whose slug the
  // user lacks stay silent; phrases stay whole (a phrase's constituent
  // tokens deliberately never become keys — ticket 13).
  const lexiconPhrases = new Map<string, string>();
  const lexiconTokens = new Map<string, string>();
  for (const entry of lexicon) {
    const categoryId = categoryIdBySlug.get(entry.slug);
    if (!categoryId) continue;
    for (const key of entry.phrases) {
      if (!lexiconPhrases.has(key)) lexiconPhrases.set(key, categoryId);
    }
    for (const key of entry.tokens) {
      if (!lexiconTokens.has(key)) lexiconTokens.set(key, categoryId);
    }
  }

  function learnedSuggestion(key: string, perCategory: Map<string, number>): Suggestion {
    // Best counter for the key: highest count, ties broken by the user's
    // category order (deterministic, mirrors the fallback's first-category).
    let categoryId = "";
    let best = -1;
    let bestOrder = Number.MAX_SAFE_INTEGER;
    for (const [id, count] of perCategory) {
      const order = categoryOrder.get(id) ?? Number.MAX_SAFE_INTEGER;
      if (count > best || (count === best && order < bestOrder)) {
        categoryId = id;
        best = count;
        bestOrder = order;
      }
    }
    let total = 0;
    for (const count of perCategory.values()) total += count;
    return {
      categoryId,
      source: "learned",
      matchedKey: key,
      confidence: { purity: total > 0 ? best / total : 0, support: best },
    };
  }

  function systemSuggestion(key: string, categoryId: string): Suggestion {
    return { categoryId, source: "system", matchedKey: key, confidence: null };
  }

  // Rung 5 — prefix. Three match shapes against every key, learned keys
  // first (longest wins within a source): the title extends a key
  // («قسطی» → «قسط»), a key completes the whole title, or a key completes
  // the trailing significant token («خرید نانوا» → «نانوایی»).
  function prefixMatches(
    keys: Iterable<string>,
    canonicalTitle: string,
    tail: string | null,
  ): { key: string; extra: number }[] {
    const matches: { key: string; extra: number }[] = [];
    const consider = (key: string) => {
      if (canonicalTitle.startsWith(key) && canonicalTitle.length > key.length) {
        matches.push({ key, extra: canonicalTitle.length - key.length });
      } else if (key.startsWith(canonicalTitle) && key.length > canonicalTitle.length) {
        matches.push({ key, extra: key.length - canonicalTitle.length });
      } else if (
        tail &&
        tail.length >= 2 &&
        key.startsWith(tail) &&
        key.length > tail.length
      ) {
        matches.push({ key, extra: key.length - tail.length });
      }
    };
    for (const key of keys) consider(key);
    return matches;
  }

  function longestKey(matches: { key: string; extra: number }[]): string | null {
    let best: string | null = null;
    for (const { key } of matches) {
      if (best === null || key.length > best.length) best = key;
    }
    return best;
  }

  function classify(title: string): Suggestion | null {
    const canonicalTitle = canonical(title);
    if (canonicalTitle === "") return null;
    const significant = canonicalTitle
      .split(" ")
      .filter((token) => !STOPWORDS.has(token));
    const phrases = phraseKeys(canonicalTitle);
    const tokens = [...new Set(significant)];

    // Rungs 1-2: learned phrase, then learned token.
    for (const key of phrases) {
      const perCategory = learnedPhrases.get(key);
      if (perCategory) return learnedSuggestion(key, perCategory);
    }
    for (const key of tokens) {
      const perCategory = learnedTokens.get(key);
      if (perCategory) return learnedSuggestion(key, perCategory);
    }
    // Rungs 3-4: lexicon phrase, then lexicon token — «اسنپ فود» must beat
    // the token «اسنپ», so phrase-before-token is load-bearing.
    for (const key of phrases) {
      const categoryId = lexiconPhrases.get(key);
      if (categoryId) return systemSuggestion(key, categoryId);
    }
    for (const key of tokens) {
      const categoryId = lexiconTokens.get(key);
      if (categoryId) return systemSuggestion(key, categoryId);
    }
    // Rung 5: prefix — research 01 gates it on a ≥3-char title.
    if (canonicalTitle.length >= 3) {
      const tail = significant.at(-1) ?? null;
      const learnedPrefix = [
        ...prefixMatches(learnedPhrases.keys(), canonicalTitle, tail),
        ...prefixMatches(learnedTokens.keys(), canonicalTitle, tail),
      ];
      const learnedKey = longestKey(learnedPrefix);
      if (learnedKey) {
        return learnedSuggestion(learnedKey, counters.get(learnedKey)!);
      }
      const lexiconPrefix = [
        ...prefixMatches(lexiconPhrases.keys(), canonicalTitle, tail),
        ...prefixMatches(lexiconTokens.keys(), canonicalTitle, tail),
      ];
      const lexiconKey = longestKey(lexiconPrefix);
      if (lexiconKey) {
        return systemSuggestion(
          lexiconKey,
          lexiconPhrases.get(lexiconKey) ?? lexiconTokens.get(lexiconKey)!,
        );
      }
    }
    // Rung 6: fuzzy Δ1 on tokens ≥ 4 chars — learned keys first (a typo
    // against the user's own vocabulary outranks the seed).
    for (const token of tokens) {
      if (token.length < 4) continue;
      for (const [key, perCategory] of learnedTokens) {
        if (withinOneEdit(token, key)) return learnedSuggestion(key, perCategory);
      }
    }
    for (const token of tokens) {
      if (token.length < 4) continue;
      for (const [key, categoryId] of lexiconTokens) {
        if (withinOneEdit(token, key)) return systemSuggestion(key, categoryId);
      }
    }
    // Rung 7: nothing — the caller decides (fallback = user's most frequent
    // category, ticket 06/22).
    return null;
  }

  return { classify };
}

/** Pure count++: one counter per extracted key for `categoryId`, creating
 * rows at 1 and leaving other categories' counters intact (purity needs
 * them). Ticket 22 turns the returned rows into upserts. */
export function learn(
  learnedKeys: readonly LearnedKeyRecord[],
  title: string,
  categoryId: string,
): LearnedKeyRecord[] {
  const keys = extractKeys(title);
  if (keys.length === 0) return [...learnedKeys];
  const result = [...learnedKeys];
  for (const key of keys) {
    const index = result.findIndex(
      (row) => row.key === key && row.categoryId === categoryId,
    );
    if (index >= 0) {
      result[index] = { ...result[index], count: result[index].count + 1 };
    } else {
      result.push({ key, categoryId, count: 1 });
    }
  }
  return result;
}

/** Pure ×0.5 soft-cancel (ticket 06): when a save contradicts the engine's
 * suggestion, the suggested category's counters for the title's keys halve —
 * a soft revoke, never a delete (pruning is ticket 22's SQL concern). */
export function decay(
  learnedKeys: readonly LearnedKeyRecord[],
  title: string,
  categoryId: string,
): LearnedKeyRecord[] {
  const keys = new Set(extractKeys(title));
  if (keys.size === 0) return [...learnedKeys];
  return learnedKeys.map((row) =>
    row.categoryId === categoryId && keys.has(row.key)
      ? { ...row, count: row.count * 0.5 }
      : row,
  );
}
