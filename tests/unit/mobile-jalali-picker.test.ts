import { describe, expect, it } from "vitest";

// Expo-mobile ticket 11 (Jalali picker): the month grid behind the calendar —
// Saturday-first offsets, month lengths, and the ISO storage value per cell.
// Cross-checked against the web ledger's known dates (2026-09-06 is day 15
// of 1405-06; 1405-06 starts on 2026-08-23, a Sunday).

import {
  JALALI_WEEKDAYS,
  dayNumberForISO,
  daysInJalaliMonth,
  isoForJalaliDay,
  leadingBlanks,
  monthKeyForISODate,
} from "../../apps/mobile/src/jalali-picker";

describe("jalali picker grid (ticket 11)", () => {
  it("starts the week on شنبه", () => {
    expect(JALALI_WEEKDAYS).toEqual(["ش", "ی", "د", "س", "چ", "پ", "ج"]);
  });

  it("counts 31 days in شهریور and 29 in a common Esfand", () => {
    expect(daysInJalaliMonth("1405-06")).toBe(31);
    expect(daysInJalaliMonth("1404-12")).toBe(29);
  });

  it("offsets the first day Saturday-first (1405-06 starts a Sunday → 1)", () => {
    expect(leadingBlanks("1405-06")).toBe(1);
  });

  it("round-trips cells through Gregorian storage", () => {
    expect(isoForJalaliDay("1405-06", 1)).toBe("2026-08-23");
    expect(isoForJalaliDay("1405-06", 15)).toBe("2026-09-06");
    expect(monthKeyForISODate("2026-09-06")).toBe("1405-06");
  });

  it("highlights only the value's own month", () => {
    expect(dayNumberForISO("2026-09-06", "1405-06")).toBe(15);
    expect(dayNumberForISO("2026-09-06", "1405-05")).toBeNull();
  });
});
