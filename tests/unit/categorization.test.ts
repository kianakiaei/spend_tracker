import { describe, expect, it } from "vitest";
import {
  createCategorizer,
  canonical,
  decay,
  extractKeys,
  learn,
  STOPWORDS,
  type LearnedKeyRecord,
  type SeedCategory,
  type UserCategoryRef,
} from "@/lib/categorization";

// Ticket 21 — the pure categorization engine (research 01). The normalizer
// and key extraction are the pre-agreed seams: ticket 22 learns with
// extractKeys, the live form (ticket 27) classifies through the engine.

describe("canonical — Persian normalizer (research 01 §2)", () => {
  it("unifies Arabic yeh/kaf into the Persian ones", () => {
    // NFKC does NOT fold these (not compatibility equivalents) — manual map
    expect(canonical("ويزيت")).toBe("ویزیت");
    expect(canonical("كارت")).toBe("کارت");
  });

  it("returns presentation forms (PDF/bank-SMS copy) to base letters via NFKC", () => {
    expect(canonical("\uFEA9")).toBe("د"); // ARABIC LETTER DAL ISOLATED FORM
    expect(canonical("\uFEDB\u0627\u0631\u062A")).toBe("کارت"); // ﻛ +ارت
  });

  it("maps Arabic-Indic and Persian digits to Latin", () => {
    expect(canonical("۵٠٠")).toBe("500");
    expect(canonical("قسط ۲")).toBe("قسط 2");
  });

  it("strips diacritics/tanvin, tatweel and invisible RTL marks", () => {
    expect(canonical("قبضِ برق")).toBe("قبض برق");
    expect(canonical("کافِه")).toBe("کافه");
    expect(canonical("قــبض")).toBe("قبض"); // tatweel
    expect(canonical("ق\u200Fبض")).toBe("قبض"); // RLM
  });

  it("treats ZWNJ as a space and collapses separators", () => {
    expect(canonical("نان سبوس\u200Cدار")).toBe("نان سبوس دار");
    expect(canonical("  خرید   نان  ")).toBe("خرید نان");
    expect(canonical("قبض\u00A0برق")).toBe("قبض برق"); // NBSP
  });

  it("lowercases Latin and folds secondary Arabic letters", () => {
    expect(canonical("Coffee")).toBe("coffee");
    expect(canonical("\u0623\u0628")).toBe("اب"); // أ → ا
    expect(canonical("مدرسة")).toBe("مدرسه"); // ة → ه
  });

  it("keeps آ intact (round-trip of the lexicon's own keys)", () => {
    expect(canonical("آرایشگاه")).toBe("آرایشگاه");
  });

  it("is idempotent and empties cleanly", () => {
    const once = canonical("قبضِ ۵٠٠ نان");
    expect(canonical(once)).toBe(once);
    expect(canonical("")).toBe("");
    expect(canonical("   \u200C  ")).toBe("");
  });
});

describe("extractKeys — the learning seam (research 01 §3)", () => {
  it("returns the full canonical phrase + bigrams + significant unigrams", () => {
    expect(extractKeys("اسنپ فود شام")).toEqual([
      "اسنپ فود شام",
      "اسنپ فود",
      "فود شام",
      "اسنپ",
      "فود",
      "شام",
    ]);
  });

  it("drops stopwords from tokens but keeps the full phrase — «خرید نان»/«نان خریدم» both reach «نان»", () => {
    expect(extractKeys("خرید نان")).toEqual(["خرید نان", "نان"]);
    expect(extractKeys("نان خریدم")).toEqual(["نان خریدم", "نان", "خریدم"]);
  });

  it("bigrams come from the remaining (significant) tokens, skipping the stopword between them", () => {
    // «به» is a stopword (ticket 13 §8.1): the significant tokens are
    // [کارت, کارت, 500], so their bigram crosses it
    expect(extractKeys("کارت به کارت ۵٠٠")).toEqual([
      "کارت به کارت 500",
      "کارت کارت",
      "کارت 500",
      "کارت",
      "500",
    ]);
  });

  it("deduplicates candidates while keeping first-seen order", () => {
    expect(extractKeys("نان نان")).toEqual(["نان نان", "نان"]);
  });

  it("normalizes whitespace before extracting", () => {
    expect(extractKeys("  خرید   نان  ")).toEqual(["خرید نان", "نان"]);
  });

  it("returns the bare phrase when only stopwords remain", () => {
    expect(extractKeys("به")).toEqual(["به"]);
    expect(extractKeys("")).toEqual([]);
  });

  it("does not treat any lexicon-relevant word as a stopword", () => {
    // the stopword list is hand-written (~20, research 01 §3) — a collision
    // with a lexicon key would silently blind that key
    for (const stopword of STOPWORDS) {
      expect(stopword).not.toMatch(/^(نان|نون|قبض|برق|گاز|قسط|اسنپ|شارژ)$/);
    }
  });
});

// --- engine (ladder, prefix, fuzzy, learning) ---

const categories: UserCategoryRef[] = [
  { id: "cat-groceries", name: "خوراکی", slug: "groceries" },
  { id: "cat-cafe", name: "کافه-رستوران", slug: "cafe-restaurant" },
  { id: "cat-transport", name: "حمل‌ونقل", slug: "transport" },
  { id: "cat-health", name: "زیبایی و درمان", slug: "health-beauty" },
  { id: "cat-installment", name: "قسط", slug: "installment" },
  { id: "cat-bills", name: "قبض و اینترنت", slug: "bills-internet" },
];

const miniLexicon = [
  { slug: "groceries", tokens: ["نان", "نانوایی"], phrases: [] },
  { slug: "cafe-restaurant", tokens: [], phrases: ["کافی شاپ"] },
  { slug: "installment", tokens: ["قسط"], phrases: [] },
] as const;

function engine(
  learnedKeys: LearnedKeyRecord[] = [],
  lexicon: readonly SeedCategory[] = miniLexicon,
) {
  return createCategorizer({ lexicon, learnedKeys, categories });
}

describe("engine — the six-rung ladder (learned phrase > learned token > lexicon phrase > lexicon token > prefix > fuzzy)", () => {
  it("a learned phrase beats a learned token with far more support", () => {
    const learned: LearnedKeyRecord[] = [
      { key: "نان", categoryId: "cat-cafe", count: 5 },
      { key: "نان بربری", categoryId: "cat-groceries", count: 2 },
    ];
    expect(engine(learned).classify("نان بربری")).toEqual({
      categoryId: "cat-groceries",
      source: "learned",
      matchedKey: "نان بربری",
      confidence: { purity: 1, support: 2 },
    });
  });

  it("any learned hit beats any lexicon hit — even token vs phrase", () => {
    const learned: LearnedKeyRecord[] = [
      { key: "اسنپ", categoryId: "cat-cafe", count: 1 },
    ];
    const lexicon = [
      { slug: "cafe-restaurant", tokens: [], phrases: ["اسنپ فود"] },
      { slug: "transport", tokens: ["اسنپ"], phrases: [] },
    ] as const;
    expect(engine(learned, lexicon).classify("اسنپ فود")).toMatchObject({
      categoryId: "cat-cafe",
      source: "learned",
      matchedKey: "اسنپ",
    });
    // and a learned phrase overrides the lexicon token
    const learnedPhrase: LearnedKeyRecord[] = [
      { key: "اسنپ فود", categoryId: "cat-cafe", count: 1 },
    ];
    expect(engine(learnedPhrase, lexicon).classify("اسنپ فود")).toMatchObject({
      categoryId: "cat-cafe",
      source: "learned",
      matchedKey: "اسنپ فود",
    });
  });

  it("reports confidence = purity × support of the counters — report only, never a gate", () => {
    const learned: LearnedKeyRecord[] = [
      { key: "نان", categoryId: "cat-groceries", count: 3 },
      { key: "نان", categoryId: "cat-cafe", count: 1 },
    ];
    expect(engine(learned).classify("خرید نان")).toEqual({
      categoryId: "cat-groceries",
      source: "learned",
      matchedKey: "نان",
      confidence: { purity: 0.75, support: 3 },
    });
  });

  it("breaks count ties by the user's category order, not row order", () => {
    // equal counts; cafe's row comes first in learnedKeys, but groceries is
    // first in the user's category list → groceries wins deterministically
    const learned: LearnedKeyRecord[] = [
      { key: "نان", categoryId: "cat-cafe", count: 2 },
      { key: "نان", categoryId: "cat-groceries", count: 2 },
    ];
    expect(engine(learned).classify("نان")?.categoryId).toBe("cat-groceries");
  });

  it("lexicon hits carry confidence: null — the seed has no counters", () => {
    expect(engine().classify("نان")).toMatchObject({
      source: "system",
      matchedKey: "نان",
      confidence: null,
    });
  });

  it("returns null for empty, whitespace and stopword-only titles", () => {
    expect(engine().classify("")).toBeNull();
    expect(engine().classify("   ")).toBeNull();
    expect(engine().classify("به")).toBeNull();
  });
});

describe("engine — prefix rung (mid-typing suggestions, never gated on confidence)", () => {
  it("completes a partial word to the longest lexicon key: «نانوا» → «نانوایی»", () => {
    expect(engine().classify("نانوا")).toEqual({
      categoryId: "cat-groceries",
      source: "system",
      matchedKey: "نانوایی",
      confidence: null,
    });
  });

  it("extends a key into a longer typed word: «قسطی» → «قسط»", () => {
    expect(engine().classify("قسطی")).toMatchObject({
      categoryId: "cat-installment",
      matchedKey: "قسط",
      source: "system",
    });
  });

  it("completes the trailing significant token of a multi-word title", () => {
    expect(engine().classify("خرید نانوا")).toMatchObject({
      categoryId: "cat-groceries",
      matchedKey: "نانوایی",
    });
  });

  it("a learned key wins the prefix rung even when a longer lexicon key completes it", () => {
    const learned: LearnedKeyRecord[] = [
      { key: "نان", categoryId: "cat-cafe", count: 1 },
    ];
    expect(engine(learned).classify("نانوا")).toEqual({
      categoryId: "cat-cafe",
      source: "learned",
      matchedKey: "نان",
      confidence: { purity: 1, support: 1 },
    });
  });

  it("runs only from 3 canonical chars, and the completing fragment needs ≥ 2", () => {
    expect(engine().classify("قا")).toBeNull(); // too short to prefix-match
    expect(engine().classify("خرید ق")).toBeNull(); // 1-char tail stays silent
  });

  it("exact tokens never reach the prefix rung", () => {
    expect(engine().classify("نان")?.matchedKey).toBe("نان");
  });
});

describe("engine — fuzzy rung (Levenshtein Δ1, token ≥ 4 chars, learned keys first)", () => {
  it("catches a typo against the user's own vocabulary with counters attached", () => {
    const learned: LearnedKeyRecord[] = [
      { key: "دندان", categoryId: "cat-health", count: 2 },
    ];
    expect(engine(learned).classify("دندون")).toEqual({
      categoryId: "cat-health",
      source: "learned",
      matchedKey: "دندان",
      confidence: { purity: 1, support: 2 },
    });
  });

  it("always reports the key it matched, never the mistyped token", () => {
    // miniLexicon has no transport row — inject one for the fuzzy pair
    const lexicon = [
      { slug: "transport", tokens: ["اتوبوس"], phrases: [] },
    ] as const;
    expect(engine([], lexicon).classify("اوتوبوس")?.matchedKey).toBe("اتوبوس");
  });

  it("skips tokens shorter than 4 chars even at Δ1", () => {
    // «برگ» is Δ1 from «برق» and Δ1 from «برگر», but 3 chars — no guess
    expect(engine().classify("برگ")).toBeNull();
  });

  it("a prefix-extension outranks a would-be fuzzy hit on the same word", () => {
    // «نانی» extends «نان» (prefix) — the earlier rung answers, matchedKey
    // stays the lexicon's own form
    expect(engine().classify("نانی")?.matchedKey).toBe("نان");
  });
});

describe("engine — injective inputs", () => {
  it("never suggests a category that is not in the user's list (stale learned rows)", () => {
    const learned: LearnedKeyRecord[] = [
      { key: "نان", categoryId: "cat-deleted", count: 9 },
    ];
    expect(engine(learned).classify("نان")).toMatchObject({
      categoryId: "cat-groceries",
      source: "system",
    });
  });

  it("ignores counters of zero — a decayed-to-nothing row suggests nothing", () => {
    const learned: LearnedKeyRecord[] = [
      { key: "نان", categoryId: "cat-cafe", count: 0 },
    ];
    expect(engine(learned).classify("نان")?.categoryId).toBe("cat-groceries");
  });

  it("lexicon keys of a system category the user lacks stay silent", () => {
    const categorizer = createCategorizer({
      lexicon: miniLexicon,
      learnedKeys: [],
      categories: [], // no categories at all — nothing can resolve
    });
    expect(categorizer.classify("نان")).toBeNull();
    expect(categorizer.classify("قسط")).toBeNull();
  });

  it("resolves lexicon slugs against the user's categories, not the lexicon names", () => {
    const renamed = [
      { id: "cat-x", name: "خرید خوراکی", slug: "groceries" },
    ];
    const categorizer = createCategorizer({
      lexicon: miniLexicon,
      learnedKeys: [],
      categories: renamed,
    });
    // a renamed system category still receives its lexicon keys (slug-bound)
    expect(categorizer.classify("نان")?.categoryId).toBe("cat-x");
  });
});

describe("learn — count++ on the extracted keys, purely", () => {
  it("creates count-1 rows for the phrase and the significant tokens", () => {
    expect(learn([], "خرید نان", "cat-groceries")).toEqual([
      { key: "خرید نان", categoryId: "cat-groceries", count: 1 },
      { key: "نان", categoryId: "cat-groceries", count: 1 },
    ]);
  });

  it("increments an existing counter for the same key and category", () => {
    const rows: LearnedKeyRecord[] = [
      { key: "نان", categoryId: "cat-groceries", count: 1 },
    ];
    expect(learn(rows, "نان", "cat-groceries")).toEqual([
      { key: "نان", categoryId: "cat-groceries", count: 2 },
    ]);
  });

  it("keeps other categories' counters on the same key — purity needs them", () => {
    const rows: LearnedKeyRecord[] = [
      { key: "نان", categoryId: "cat-groceries", count: 3 },
    ];
    expect(learn(rows, "خرید نان", "cat-cafe")).toEqual([
      { key: "نان", categoryId: "cat-groceries", count: 3 },
      { key: "خرید نان", categoryId: "cat-cafe", count: 1 },
      { key: "نان", categoryId: "cat-cafe", count: 1 },
    ]);
  });

  it("does not mutate the input rows", () => {
    const rows: LearnedKeyRecord[] = [
      { key: "نان", categoryId: "cat-groceries", count: 1 },
    ];
    learn(rows, "نان", "cat-groceries");
    expect(rows).toEqual([{ key: "نان", categoryId: "cat-groceries", count: 1 }]);
  });

  it("learning a stopword-only title stores just the bare phrase; empty stores nothing", () => {
    // literal research 01 §3: the full canonical phrase is always a candidate
    expect(learn([], "به", "cat-groceries")).toEqual([
      { key: "به", categoryId: "cat-groceries", count: 1 },
    ]);
    expect(learn([], "  ", "cat-groceries")).toEqual([]);
  });
});

describe("decay — ×0.5 soft-cancel on contradiction, purely", () => {
  it("halves only the contradicted category's counters for the title's keys", () => {
    const rows: LearnedKeyRecord[] = [
      { key: "نان", categoryId: "cat-groceries", count: 4 },
      { key: "بربری", categoryId: "cat-groceries", count: 2 },
      { key: "نون", categoryId: "cat-groceries", count: 1 },
    ];
    expect(decay(rows, "نان بربری", "cat-groceries")).toEqual([
      { key: "نان", categoryId: "cat-groceries", count: 2 },
      { key: "بربری", categoryId: "cat-groceries", count: 1 },
      { key: "نون", categoryId: "cat-groceries", count: 1 },
    ]);
  });

  it("leaves other categories and unknown keys untouched, and never deletes rows", () => {
    const rows: LearnedKeyRecord[] = [
      { key: "نان", categoryId: "cat-groceries", count: 3 },
      { key: "نان", categoryId: "cat-cafe", count: 2 },
      { key: "نون", categoryId: "cat-groceries", count: 1 },
    ];
    expect(decay(rows, "خرید نان", "cat-cafe")).toEqual([
      { key: "نان", categoryId: "cat-groceries", count: 3 },
      { key: "نان", categoryId: "cat-cafe", count: 1 },
      { key: "نون", categoryId: "cat-groceries", count: 1 },
    ]);
  });

  it("compounds across contradictions: 3 → 1.5 → 0.75", () => {
    const rows: LearnedKeyRecord[] = [
      { key: "نان", categoryId: "cat-groceries", count: 3 },
    ];
    const once = decay(rows, "نان", "cat-groceries");
    expect(decay(once, "نان", "cat-groceries")).toEqual([
      { key: "نان", categoryId: "cat-groceries", count: 0.75 },
    ]);
  });

  it("does not mutate the input rows", () => {
    const rows: LearnedKeyRecord[] = [
      { key: "نان", categoryId: "cat-groceries", count: 3 },
    ];
    decay(rows, "نان", "cat-groceries");
    expect(rows).toEqual([{ key: "نان", categoryId: "cat-groceries", count: 3 }]);
  });
});
