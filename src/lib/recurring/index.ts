import { endOfJalaliMonth, fromISODate, fromJalaliMonthKey, jalaliDaysInMonth, startOfJalaliMonth, toISODate } from "@/lib/jalali";

// Pure recurring-template logic (ticket 23) — the shared core of ensure
// (lazy generation, decision 14) and preview (forecast rows, decision 15).
// Everything here is db-free and next-free: the service layer hands plain
// rows in and maps results out.

/** Gregorian date-only span of a Jalali month — the window the template
 * predicate compares against. */
export interface JalaliMonthBounds {
  startISO: string;
  endISO: string;
  daysInMonth: number;
}

/** The fields the due-in-month predicate reads — any template row satisfies
 * this structurally. */
export interface RecurringWindow {
  active: boolean;
  // Gregorian date-only strings (the stored format, ticket 04).
  startDate: string;
  endDate: string | null;
}

/** The fields the forecast-row mapper reads. */
export interface RecurringTemplateCore {
  id: string;
  title: string;
  amountToman: number;
  categoryId: string;
  dayOfMonth: number;
}

/** The ticket-12 preview contract row: `GET /api/v1/recurring-templates/
 * preview?month=` item — `day` is the clamped Jalali day-of-month. */
export interface RecurringForecastRow {
  templateId: string;
  title: string;
  amountToman: number;
  categoryId: string;
  day: number;
}

export type MonthPosition = "past" | "current" | "future";

export function jalaliMonthBounds(monthKey: string): JalaliMonthBounds {
  const first = fromJalaliMonthKey(monthKey);
  return {
    startISO: toISODate(startOfJalaliMonth(first)),
    endISO: toISODate(endOfJalaliMonth(first)),
    daysInMonth: jalaliDaysInMonth(first),
  };
}

/** The ticket-14 predicate, shared verbatim by ensure and preview: active,
 * started by the month's end, and not ended before the month's start. The
 * only gate on generation is startDate — a mid-month template with a past
 * day still generates this month (backdated, decision 14). */
export function isTemplateDueInMonth(
  template: RecurringWindow,
  monthKey: string,
): boolean {
  if (!template.active) return false;
  const { startISO, endISO } = jalaliMonthBounds(monthKey);
  // ISO date-only strings compare correctly as plain strings.
  return (
    template.startDate <= endISO &&
    (template.endDate === null || template.endDate >= startISO)
  );
}

/** Jalali day-of-month clamped into what the month actually has: day 30/31
 * in a 29- or 30-day month sticks to the last day (ticket 05). */
export function clampedDayOfMonth(dayOfMonth: number, monthKey: string): number {
  return Math.min(dayOfMonth, jalaliDaysInMonth(fromJalaliMonthKey(monthKey)));
}

/** Gregorian date-only string of the template's occurrence in a month —
 * the generated expense's `occurredAt` (and the preview `day`'s date). */
export function occurrenceISO(monthKey: string, dayOfMonth: number): string {
  const first = fromISODate(jalaliMonthBounds(monthKey).startISO);
  const day = clampedDayOfMonth(dayOfMonth, monthKey);
  // Day arithmetic within one month is calendar-agnostic: the Jalali month's
  // day n is n-1 Gregorian days past its first day.
  first.setDate(first.getDate() + day - 1);
  return toISODate(first);
}

/** The ensure gate: reads only ever generate the CURRENT Jalali month —
 * past months fill on template writes (backfill), never on reads, and the
 * future belongs to preview. */
export function monthPosition(
  monthKey: string,
  currentMonthKey: string,
): MonthPosition {
  if (monthKey < currentMonthKey) return "past";
  if (monthKey > currentMonthKey) return "future";
  return "current";
}

/** The forecast row for a template in a month — same clamp as generation
 * (decision 15: "همان قاعدهٔ تولید"). */
export function toForecastRow(
  template: RecurringTemplateCore,
  monthKey: string,
): RecurringForecastRow {
  return {
    templateId: template.id,
    title: template.title,
    amountToman: template.amountToman,
    categoryId: template.categoryId,
    day: clampedDayOfMonth(template.dayOfMonth, monthKey),
  };
}
