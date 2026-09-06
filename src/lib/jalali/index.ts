import {
  addMonths,
  endOfMonth,
  format,
  getDaysInMonth,
  newDate,
  parseISO,
  startOfMonth,
} from "date-fns-jalali";
import { dateOnlySchema, jalaliMonthKeySchema } from "@/lib/schemas";

// The one module in the app that knows about calendars (ticket 12). Dates
// are stored as Gregorian date-only strings 'YYYY-MM-DD'; Jalali exists only
// in display and grouping. Pure — no `next/*` imports — so route handlers,
// RSC and the browser all share it (ticket 20).

/** Gregorian date-only string of a Date, from its local calendar parts. */
export function toISODate(d: Date): string {
  const y = String(d.getFullYear()).padStart(4, "0");
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Local-midnight Date of a Gregorian date-only string — parseISO, never
 * new Date('YYYY-MM-DD') (that parses UTC and shifts a day off-zone). */
export function fromISODate(iso: string): Date {
  if (!dateOnlySchema.safeParse(iso).success) {
    throw new RangeError(
      `expected a Gregorian date-only string 'YYYY-MM-DD', got ${JSON.stringify(iso)}`,
    );
  }
  const d = parseISO(iso);
  if (Number.isNaN(d.getTime())) {
    throw new RangeError(`not a real calendar date: ${JSON.stringify(iso)}`);
  }
  return d;
}

/** Jalali month key '1405-06' — the grouping unit for all monthly sums;
 * zero-padded and lexically sortable. */
export function jalaliMonthKey(d: Date): string {
  return format(d, "yyyy-MM");
}

/** First moment of the Jalali month containing d. */
export function startOfJalaliMonth(d: Date): Date {
  return startOfMonth(d);
}

/** Last moment of the Jalali month containing d (23:59:59.999); prefer an
 * exclusive upper bound — startOfJalaliMonth(addJalaliMonths(d, 1)) — for
 * range queries. */
export function endOfJalaliMonth(d: Date): Date {
  return endOfMonth(d);
}

/** Days in the Jalali month containing d: 31 / 30 / 29-30 (leap Esfand). */
export function jalaliDaysInMonth(d: Date): number {
  return getDaysInMonth(d);
}

/** n months away in the Jalali calendar; a day beyond the target month's
 * length clamps to that month's last day (30th of Esfand → 29th). */
export function addJalaliMonths(d: Date, n: number): Date {
  return addMonths(d, n);
}

/** n months away from a Jalali month key — the month navigator's step
 * ('1405-12' + 1 → '1406-01'). Built on day 1 of the month, so no clamping
 * can ever apply; invalid keys throw like fromJalaliMonthKey. */
export function shiftJalaliMonthKey(monthKey: string, n: number): string {
  return jalaliMonthKey(addJalaliMonths(fromJalaliMonthKey(monthKey), n));
}

const tehranISODate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tehran",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Current Jalali month key on the Tehran calendar day — the server runs on
 * UTC, but the monthly boundary is Tehran midnight (ticket 14). */
export function currentJalaliMonthKey(now: Date = new Date()): string {
  return jalaliMonthKey(fromISODate(tehranISODate.format(now)));
}

/** Current Gregorian date-only string on the Tehran calendar day — the
 * date-only counterpart of currentJalaliMonthKey, so a «today» default and
 * the current-month comparison can never disagree (ticket 27). */
export function currentTehranISODate(now: Date = new Date()): string {
  return tehranISODate.format(now);
}

/** Local-midnight Date of the FIRST day of the Jalali month a key names —
 * the monthKey→Date inverse of jalaliMonthKey ('1405-06' → 2026-08-23).
 * The month-key-based recurring logic (ticket 23) builds its month bounds
 * and occurrence dates on this. */
export function fromJalaliMonthKey(monthKey: string): Date {
  if (!jalaliMonthKeySchema.safeParse(monthKey).success) {
    throw new RangeError(
      `expected a Jalali month key 'YYYY-MM', got ${JSON.stringify(monthKey)}`,
    );
  }
  const [y, m] = monthKey.split("-").map(Number);
  return newDate(y!, m! - 1, 1);
}

// --- display (the only place Jalali becomes visible text) ---

const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

/** Latin digits → Persian digits; letters and punctuation untouched. */
export function toPersianDigits(value: string | number): string {
  return String(value).replace(
    /[0-9]/g,
    (digit) => FA_DIGITS[Number(digit)],
  );
}

/** Persian (۶۶-۶F) and Arabic-Indic (۶۶۰-۶۶۹) digits → Latin, for parsing
 * anything a user typed. */
export function toEnglishDigits(s: string): string {
  return s
    .replace(/[\u06F0-\u06F9]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x0660));
}

/** Jalali date in a date-fns-jalali pattern, Persian digits — display only.
 * Default 'yyyy/MM/dd' → '۱۴۰۵/۰۶/۱۵'. */
export function formatJalali(d: Date, pattern = "yyyy/MM/dd"): string {
  return toPersianDigits(format(d, pattern));
}

/** 'شهریور ۱۴۰۵' — dashboard month heading. */
export function jalaliMonthLabel(d: Date): string {
  return toPersianDigits(format(d, "MMMM yyyy"));
}

/** 'یک‌شنبه ۱۵ شهریور' — list-row date. */
export function jalaliDayLabel(d: Date): string {
  return toPersianDigits(format(d, "EEEE d MMMM"));
}

/** Jalali day-of-month of d as a plain number (1..31) — the ledger sorts
 * recorded rows and forecast rows into one chronological list on it. */
export function jalaliDayOfMonth(d: Date): number {
  return Number(format(d, "d"));
}

const jalaliIntl = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  dateStyle: "full",
});

/** Canonical full date via ICU's persian calendar — the Intl counterpart of
 * date-fns-jalali for ready-made display strings (research 04, §4). */
export function jalaliIntlDate(d: Date): string {
  return jalaliIntl.format(d);
}

const tomanFormat = new Intl.NumberFormat("fa-IR", {
  maximumFractionDigits: 0,
});

/** Integer tomans → '۱٬۲۳۴٬۵۶۷ تومان' (toman is no ISO currency; suffix by hand). */
export function formatToman(amount: number): string {
  return `${tomanFormat.format(amount)} تومان`;
}
