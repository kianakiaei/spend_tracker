import { fromISODate, jalaliMonthKey, toEnglishDigits } from "@/lib/jalali";

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

/** Raw quantity field text → integer ≥1, or null while empty/invalid.
 * Empty means 1 (the default) at save time. */
export function parseQuantityInput(raw: string): number | null {
  const trimmed = toEnglishDigits(raw).trim().replace(/[٬,]/g, "");
  if (trimmed === "") return null;
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isSafeInteger(value) && value >= 1 ? value : null;
}

/** The Jalali month a save will land in (ticket 15/27): a picked date always
 * wins — its own month, even when it differs from the form's month; an
 * undated create belongs to the form's month; an undated edit stays in the
 * month the expense already belongs to (clearing never moves it — the
 * expense service's rule). */
export function effectiveMonthKey(
  date: string | null,
  entryMonthKey: string,
  existingMonthKey?: string,
): string {
  if (date !== null) return jalaliMonthKey(fromISODate(date));
  return existingMonthKey ?? entryMonthKey;
}
