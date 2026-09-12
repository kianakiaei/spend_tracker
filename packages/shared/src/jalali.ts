import {
  addMonths,
  endOfMonth,
  format,
  getDaysInMonth,
  newDate,
  parseISO,
  startOfMonth,
} from "date-fns-jalali";
import { dateOnlySchema, jalaliMonthKeySchema } from "./schemas/domain";

// The one module in the app that knows about calendars (ticket 12). Dates
// are stored as Gregorian date-only strings 'YYYY-MM-DD'; Jalali exists only
// in display and grouping. Pure — no `next/*` imports — so route handlers,
// RSC and the browser all share it (ticket 20). Extracted verbatim into
// @spend-tracker/shared for the Expo mobile app (expo-mobile ticket 01).

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
 * ('1405-12' + 1 → '1406-01'). Integer year/month arithmetic, not a Date:
 * converting the key through local midnight can land in the previous Jalali
 * month in some timezones, which made «ماه بعد» a no-op and «ماه قبل» skip
 * two months. Invalid keys throw like fromJalaliMonthKey. */
export function shiftJalaliMonthKey(monthKey: string, n: number): string {
  const [year, month] = parseJalaliMonthKey(monthKey);
  const index = year * 12 + (month - 1) + n;
  const nextYear = Math.floor(index / 12);
  const nextMonth = index - nextYear * 12 + 1;
  return `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}`;
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
  const [year, month] = parseJalaliMonthKey(monthKey);
  return newDate(year, month - 1, 1);
}

/** Gregorian date-only string of a Jalali (monthKey, day-of-month) pair —
 * the generated expense's `occurredAt` and the picker's storage value. The
 * day clamps into what the month actually has (day 31 in a 30-day month
 * sticks to the 30th). Day arithmetic within one month is calendar-agnostic:
 * the Jalali month's day n is n-1 Gregorian days past its first day.
 * Moved verbatim from the recurring service (expo-mobile ticket 11) so the
 * server and the mobile picker share one day-math. */
export function occurrenceISO(monthKey: string, dayOfMonth: number): string {
  const first = fromJalaliMonthKey(monthKey);
  const day = Math.min(dayOfMonth, jalaliDaysInMonth(first));
  const date = fromISODate(toISODate(startOfJalaliMonth(first)));
  date.setDate(date.getDate() + day - 1);
  return toISODate(date);
}

function parseJalaliMonthKey(monthKey: string): [number, number] {
  if (!jalaliMonthKeySchema.safeParse(monthKey).success) {
    throw new RangeError(
      `expected a Jalali month key 'YYYY-MM', got ${JSON.stringify(monthKey)}`,
    );
  }
  const [year, month] = monthKey.split("-").map(Number);
  return [year!, month!];
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

const JALALI_MONTH_NAMES = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
] as const;

/** 'شهریور ۱۴۰۵' — dashboard month heading. */
export function jalaliMonthLabel(d: Date): string {
  return toPersianDigits(format(d, "MMMM yyyy"));
}

/** 'شهریور ۱۴۰۵' from a month key — no Date, so the label cannot slip a
 * month when the runtime timezone is not Tehran. */
export function jalaliMonthKeyLabel(monthKey: string): string {
  const [year, month] = parseJalaliMonthKey(monthKey);
  return `${JALALI_MONTH_NAMES[month - 1]} ${toPersianDigits(year)}`;
}

/** 'شهریور' from a month key — chart ticks, same Date-free path. */
export function jalaliMonthNameFromKey(monthKey: string): string {
  const [, month] = parseJalaliMonthKey(monthKey);
  return JALALI_MONTH_NAMES[month - 1]!;
}

/** '۱۵ شهریور ۱۴۰۵' from a stored Gregorian date-only string. Built from
 * the civil Y-M-D parts (parseISO → local midnight), matching formatJalali
 * with 'd MMMM yyyy'. */
export function formatJalaliISODate(iso: string): string {
  return toPersianDigits(format(fromISODate(iso), "d MMMM yyyy"));
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
