import { fromISODate, jalaliMonthKey, toEnglishDigits, toISODate, fromJalaliMonthKey, currentJalaliMonthKey, currentTehranISODate } from "@/lib/jalali";

// Pure edges of the expense sheet (ticket 27) — no React, no `next/*`, so
// they unit-test without a DOM. The sheet owns the stateful parts around
// them.

/** Raw amount field text → positive integer tomans, or null while it is not
 * one yet (empty, separators-only, zero). Any digit script and any typed
 * separators are accepted; the formatted fa-IR display is the input's live
 * hint, never parsed back. */
export function parseAmountInput(raw: string): number | null {
  const digits = toEnglishDigits(raw).replace(/\D+/g, "");
  if (digits === "") return null;
  const value = Number(digits);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

/** Raw quantity field text → positive number with up to 3 decimals (0.5
 * kilo), or null while empty/invalid. Empty means 1 (the default) at save
 * time. Counted pieces must still be whole — the sheet enforces that
 * against the picked unit. Separators (٬ ,) are ignored; the decimal mark
 * may be . or ٫ in any digit script. */
export function parseQuantityInput(raw: string): number | null {
  const normalized = toEnglishDigits(raw)
    .trim()
    .replace(/[٬,\s]/g, "");
  if (normalized === "") return null;
  // Decimal mark: Latin dot or the Arabic decimal separator (U+066B).
  const dotted = normalized.replace(/٫/g, ".");
  if (!/^\d+(\.\d{1,3})?$/.test(dotted)) return null;
  const value = Number(dotted);
  if (!Number.isFinite(value) || value > 1_000_000 || value <= 0)
    return null;
  return value;
}

/** The Jalali month a save will land in: always the picked date's month. */
export function effectiveMonthKey(date: string): string {
  return jalaliMonthKey(fromISODate(date));
}

/** Create-form date default: today in the current Jalali month, otherwise
 * the first day of the month the form was opened in. */
export function defaultCreateDate(
  formMonthKey: string,
  now: Date = new Date(),
): string {
  if (formMonthKey === currentJalaliMonthKey(now)) {
    return currentTehranISODate(now);
  }
  return toISODate(fromJalaliMonthKey(formMonthKey));
}
