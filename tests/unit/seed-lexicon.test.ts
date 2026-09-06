import { describe, expect, it } from "vitest";
import {
  createCategorizer,
  canonical,
  SEED_LEXICON,
  STOPWORDS,
  SYSTEM_CATEGORIES,
  type LearnedKeyRecord,
  type UserCategoryRef,
} from "@/lib/categorization";

// Ticket 13's frozen lexicon + ticket 21's invariant: every key is already
// canonical (the normalizer of research 01). The seed is data-only — this
// file is the guard against edits that silently de-canonicalize it. The §8
// checklist runs row by row through the real engine below.

const userCategories: UserCategoryRef[] = SYSTEM_CATEGORIES.map((category) => ({
  id: `cat-${category.slug}`,
  name: category.name,
  slug: category.slug,
}));

function classifyWithSeed(title: string, learnedKeys: LearnedKeyRecord[] = []) {
  return createCategorizer({
    lexicon: SEED_LEXICON,
    learnedKeys,
    categories: userCategories,
  }).classify(title);
}

describe("seed lexicon invariants (ticket 13)", () => {
  it("has the six system categories with their frozen slugs and names", () => {
    expect(SYSTEM_CATEGORIES.map((c) => c.slug)).toEqual([
      "groceries",
      "cafe-restaurant",
      "transport",
      "health-beauty",
      "installment",
      "bills-internet",
    ]);
    expect(SYSTEM_CATEGORIES.map((c) => c.name)).toEqual([
      "خوراکی",
      "کافه-رستوران",
      "حمل‌ونقل",
      "زیبایی و درمان",
      "قسط",
      "قبض و اینترنت",
    ]);
  });

  it("holds 74 canonical keys: 68 token + 6 phrase (ticket 13)", () => {
    const tokens = SEED_LEXICON.flatMap((entry) => entry.tokens);
    const phrases = SEED_LEXICON.flatMap((entry) => entry.phrases);
    expect(tokens).toHaveLength(68);
    expect(phrases).toHaveLength(6);
    expect(tokens.length + phrases.length).toBe(74);
  });

  it("every key equals its own canonical form", () => {
    for (const entry of SEED_LEXICON) {
      for (const key of [...entry.tokens, ...entry.phrases]) {
        expect(canonical(key), key).toBe(key);
      }
    }
  });

  it("keys are unique across the whole lexicon — a Map can't silently overwrite", () => {
    const all = SEED_LEXICON.flatMap((entry) => [...entry.tokens, ...entry.phrases]);
    expect(new Set(all).size).toBe(all.length);
  });

  it("tokens are single words, phrases are multi-word, nothing collides with stopwords", () => {
    for (const entry of SEED_LEXICON) {
      for (const token of entry.tokens) {
        expect(token.includes(" "), token).toBe(false);
        expect(STOPWORDS.has(token), token).toBe(false);
      }
      for (const phrase of entry.phrases) {
        expect(phrase.includes(" "), phrase).toBe(true);
        for (const word of phrase.split(" ")) {
          expect(STOPWORDS.has(word), `${phrase} → ${word}`).toBe(false);
        }
      }
    }
  });

  it("every entry's slug is one of the system slugs", () => {
    const slugs = SYSTEM_CATEGORIES.map((c) => c.slug);
    for (const entry of SEED_LEXICON) {
      expect(slugs).toContain(entry.slug);
    }
  });
});

describe("§8 checklist of research 01, row by row (ticket 13's table)", () => {
  it("«نون» → groceries via the seed token alias", () => {
    expect(classifyWithSeed("نون")).toEqual({
      categoryId: "cat-groceries",
      source: "system",
      matchedKey: "نون",
      confidence: null,
    });
  });

  it("«تاکسی اینترنتی» / «قطار شهری» → transport via head tokens — no phrase key needed", () => {
    expect(classifyWithSeed("تاکسی اینترنتی")?.matchedKey).toBe("تاکسی");
    expect(classifyWithSeed("قطار شهری")?.matchedKey).toBe("قطار");
    expect(classifyWithSeed("تاکسی اینترنتی")?.categoryId).toBe("cat-transport");
    expect(classifyWithSeed("قطار شهری")?.categoryId).toBe("cat-transport");
  });

  it("«نان سبوس‌دار» in three ZWNJ spellings → groceries via token «نان»", () => {
    for (const title of ["نان سبوس\u200Cدار", "نان سبوس دار", "نان سبوسدار"]) {
      const guess = classifyWithSeed(title);
      expect(guess?.categoryId, title).toBe("cat-groceries");
      expect(guess?.matchedKey, title).toBe("نان");
    }
  });

  it("«قبضِ برق» → bills-internet — diacritics stripped, first head token wins", () => {
    expect(classifyWithSeed("قبضِ برق")).toMatchObject({
      categoryId: "cat-bills-internet",
      matchedKey: "قبض",
      source: "system",
    });
  });

  it("«كارت به كارت ۵٠٠» → null — normalized but deliberately keyless, «به» is a stopword", () => {
    expect(classifyWithSeed("كارت به كارت ۵٠٠")).toBeNull();
  });

  it("«خرید نان» / «نان خریدم» → groceries — the stopword drops, token «نان» stays", () => {
    expect(classifyWithSeed("خرید نان")?.matchedKey).toBe("نان");
    expect(classifyWithSeed("نان خریدم")?.matchedKey).toBe("نان");
    expect(classifyWithSeed("خرید نان")?.categoryId).toBe("cat-groceries");
    expect(classifyWithSeed("نان خریدم")?.categoryId).toBe("cat-groceries");
  });

  it("«خرید» alone and «بیمه» alone → null — deliberately keyless for purity", () => {
    expect(classifyWithSeed("خرید")).toBeNull();
    expect(classifyWithSeed("بیمه")).toBeNull();
  });

  it("«2000» and «Coffee» → null — numeric/Latin-only titles guess nothing", () => {
    expect(classifyWithSeed("2000")).toBeNull();
    expect(classifyWithSeed("Coffee")).toBeNull();
  });

  it("«اوتوبوس» → transport via fuzzy Δ1 on «اتوبوس» (7-char token, deliberately no alias)", () => {
    expect(classifyWithSeed("اوتوبوس")).toEqual({
      categoryId: "cat-transport",
      source: "system",
      matchedKey: "اتوبوس",
      confidence: null,
    });
  });

  it("«دندون» → health-beauty only through learning — the frozen seed has no Δ1 partner", () => {
    // Registered deviation from the §8 row: Levenshtein(دندون, دندانپزشک) = 5,
    // so with the frozen seed alone the conservative answer is null (purity
    // first). The row's mechanism is real — fuzzy Δ1 against learned keys:
    const learned: LearnedKeyRecord[] = [
      { key: "دندان", categoryId: "cat-health-beauty", count: 1 },
    ];
    expect(classifyWithSeed("دندون", learned)).toEqual({
      categoryId: "cat-health-beauty",
      source: "learned",
      matchedKey: "دندان",
      confidence: { purity: 1, support: 1 },
    });
    expect(classifyWithSeed("دندون")).toBeNull();
  });

  it("«اسنپ فود» / «اسنپ مارکت» beat the token «اسنپ» — phrase before token carries meaning", () => {
    expect(classifyWithSeed("اسنپ فود")).toEqual({
      categoryId: "cat-cafe-restaurant",
      source: "system",
      matchedKey: "اسنپ فود",
      confidence: null,
    });
    expect(classifyWithSeed("اسنپ مارکت")?.categoryId).toBe("cat-groceries");
    // the token alone still goes to transport
    expect(classifyWithSeed("اسنپ")?.categoryId).toBe("cat-transport");
  });

  it("«اسنپ فود شام» → cafe-restaurant via the adjacent bigram of significant tokens", () => {
    expect(classifyWithSeed("اسنپ فود شام")).toMatchObject({
      categoryId: "cat-cafe-restaurant",
      matchedKey: "اسنپ فود",
    });
  });
});
