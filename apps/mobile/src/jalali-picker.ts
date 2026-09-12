// Jalali date-picker core (expo-mobile ticket 11).
//
// Pure month-grid math behind the picker's calendar: how many days a Jalali
// month has, where its first day lands in a Saturday-first grid (the Jalali
// week starts شنبه), and the ISO storage value for a picked cell. Storage
// stays Gregorian ISO (the spec's hard rule); Jalali exists only in display.
// The component in components/jalali-date-picker.tsx renders this.

import {
  fromISODate,
  jalaliDaysInMonth,
  fromJalaliMonthKey,
  jalaliMonthKey,
  occurrenceISO,
  startOfJalaliMonth,
  toISODate,
} from "@spend-tracker/shared/jalali";

/** Saturday-first grid header — the conventional Iranian calendar row. */
export const JALALI_WEEKDAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"] as const;

/** Days in the Jalali month a key names (31 / 30 / 29-30 leap Esfand). */
export function daysInJalaliMonth(monthKey: string): number {
  return jalaliDaysInMonth(fromJalaliMonthKey(monthKey));
}

/** Blank cells before day 1 in a Saturday-first grid: شنبه → 0 … جمعه → 6. */
export function leadingBlanks(monthKey: string): number {
  const first = fromISODate(
    toISODate(startOfJalaliMonth(fromJalaliMonthKey(monthKey))),
  );
  return (first.getDay() + 1) % 7;
}

/** The Jalali month an ISO date falls in (the picker's initial page). */
export function monthKeyForISODate(iso: string): string {
  return jalaliMonthKey(fromISODate(iso));
}

/** Storage value for a picked cell (clamped like the server day-math). */
export function isoForJalaliDay(monthKey: string, day: number): string {
  return occurrenceISO(monthKey, day);
}

/** The selected cell's day number within its month, or null while the value
 * belongs to another month (nothing highlights). */
export function dayNumberForISO(
  iso: string,
  monthKey: string,
): number | null {
  const days = daysInJalaliMonth(monthKey);
  for (let day = 1; day <= days; day++) {
    if (occurrenceISO(monthKey, day) === iso) return day;
  }
  return null;
}
