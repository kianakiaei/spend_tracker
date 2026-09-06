import { describe, expect, it } from "vitest";
import { canonical, extractKeys, STOPWORDS } from "@/lib/categorization";

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
