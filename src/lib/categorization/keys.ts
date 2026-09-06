import { canonical } from "./normalize";

// Key extraction (research 01 §3): what counts as a "word" of a title, for
// both dictionary lookup (the engine's phrase/token rungs) and learning
// (ticket 22 upserts exactly these keys into learnedKeys).

// Hand-written stopword list for expense titles (~20, research 01 §3) — not
// hazm's 700-entry general list. Deliberately excludes every lexicon key:
// «خرید نان» and «نان خریدم» must both reach «نان».
export const STOPWORDS: ReadonlySet<string> = new Set([
  "خرید", "هزینه", "بابت", "برای", "از", "به", "و", "در",
  "دارم", "دادم", "کردم", "رفتم", "یک", "با", "تا", "را",
  "هم", "که", "می", "شد",
]);

function tokenize(canonicalTitle: string): string[] {
  if (canonicalTitle === "") return [];
  return canonicalTitle.split(" ");
}

/** Tokens that survive the stopword filter, in title order. */
function significantTokens(canonicalTitle: string): string[] {
  return tokenize(canonicalTitle).filter((t) => !STOPWORDS.has(t));
}

function dedupePreservingFirst(keys: string[]): string[] {
  return [...new Set(keys)];
}

/** Phrase lookup candidates for a canonical title: the full title first
 * (most specific), then adjacent bigrams of the significant tokens —
 * «اسنپ فود شام» finds the lexicon phrase «اسنپ فود». Bigrams come from the
 * post-stopword sequence (research 01 §3: "bigramهای توکن‌های باقی‌مانده"). */
export function phraseKeys(canonicalTitle: string): string[] {
  const significant = significantTokens(canonicalTitle);
  const bigrams = significant.slice(1).map((token, i) => `${significant[i]} ${token}`);
  return dedupePreservingFirst([canonicalTitle, ...bigrams]).filter((k) => k !== "");
}

/** All keys a title contributes to learning (ticket 06: «عبارت + توکن‌های
 * بارز، بدون stopword»): full canonical phrase, significant bigrams, and
 * significant unigrams — deduped. Learned rows split by shape on the way
 * back in: keys with a space land in the phrase map, single words in the
 * token map, so lookup and extraction stay symmetric. */
export function extractKeys(title: string): string[] {
  const canonicalTitle = canonical(title);
  const unigrams = significantTokens(canonicalTitle);
  return dedupePreservingFirst([...phraseKeys(canonicalTitle), ...unigrams]);
}
