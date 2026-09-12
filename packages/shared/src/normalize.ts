// The Persian normalizer (research 01 §2, rules traced to hazm) — the
// pipeline every title AND every lexicon key goes through, so both live in
// one canonical form. Pure, ~20 lines, no dependencies.

// Hazm's translation table. NFKC does NOT fold ي/ك (they are not
// compatibility equivalents) — the manual map is mandatory.
const CHAR_MAP: Record<string, string> = {
  "\u064A": "\u06CC", // ي (arabic yeh) → ی
  "\u0643": "\u06A9", // ك (arabic kaf) → ک
  "\u0623": "\u0627", // أ → ا
  "\u0625": "\u0627", // إ → ا
  "\u0671": "\u0627", // ٱ → ا
  "\u0629": "\u0647", // ة → ه
};

// Diacritics/tanvin (fathatan..sukun), superscript alef, tatweel, and the
// invisible LTR/RTL direction marks that arrive from copy-paste.
const STRIP = /[\u064B-\u0652\u0670\u0640\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

// Persian (۰-۹) and Arabic-Indic (٠-٩) digits → Latin: display is a separate
// layer (jalali module), internal comparison wants one digit set.
const DIGITS = /[\u06F0-\u06F9\u0660-\u0669]/g;

// Every separator is the same separator: spaces, NBSP and ZWNJ (U+200C) all
// collapse to one ASCII space, so «سبوس‌دار / سبوس دار / سبوسدار» differ only
// by whether a key's token is whole. \b is useless with Persian (\w is
// ASCII-only) — this explicit class is the tokenizer's boundary.
const SEP = /[\s\u00A0\u200C]+/g;

/** Canonical form of a free-typed Persian (or Latin) expense title: NFKC for
 * presentation-form copy, diacritics/RTL marks stripped, digits to Latin,
 * Latin lowercased, yeh/kaf unified, every separator one ASCII space. */
export function canonical(input: string): string {
  let s = input.normalize("NFKC");
  s = s.replace(STRIP, "").replace(DIGITS, (d) => String(d.charCodeAt(0) & 0xf));
  s = s.toLowerCase();
  for (const [src, dst] of Object.entries(CHAR_MAP)) {
    s = s.split(src).join(dst);
  }
  return s.replace(SEP, " ").trim();
}
