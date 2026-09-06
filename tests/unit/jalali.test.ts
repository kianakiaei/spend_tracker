import { describe, expect, it, vi } from "vitest";
import {
  addJalaliMonths,
  currentJalaliMonthKey,
  fromISODate,
  jalaliDaysInMonth,
  jalaliMonthKey,
  endOfJalaliMonth,
  startOfJalaliMonth,
  toISODate,
} from "@/lib/jalali";

// Ticket 20 — the single jalali calendar module. Hard rule (ticket 04):
// dates are always Gregorian date-only strings 'YYYY-MM-DD'; a Date is only
// ever built with parseISO (local midnight), never new Date('YYYY-MM-DD').

describe("date-only strings (store format)", () => {
  it("round-trips through a local-midnight Date", () => {
    const d = fromISODate("2026-09-06");
    // local midnight — same instant the Date constructor gives for these
    // parts, never a UTC parse shifted by the runtime zone
    expect(d.getTime()).toBe(new Date(2026, 8, 6).getTime());
    expect(toISODate(d)).toBe("2026-09-06");
  });

  it("rejects strings that are not date-only", () => {
    expect(() => fromISODate("2026-09-06T15:00")).toThrow(RangeError);
    expect(() => fromISODate("06/09/2026")).toThrow(RangeError);
    expect(() => fromISODate("")).toThrow(RangeError);
  });

  it("rejects format-valid but non-existent calendar dates", () => {
    expect(() => fromISODate("2026-02-30")).toThrow(RangeError);
  });
});

describe("jalali month grouping", () => {
  it("derives the month key from Gregorian dates across year boundaries", () => {
    // anchors verified against date-fns-jalali (jalaali-js) and ICU persian
    expect(jalaliMonthKey(fromISODate("2026-09-06"))).toBe("1405-06");
    expect(jalaliMonthKey(fromISODate("2026-03-21"))).toBe("1405-01"); // Nowruz
    expect(jalaliMonthKey(fromISODate("2026-03-20"))).toBe("1404-12"); // last day of 1404
    expect(jalaliMonthKey(fromISODate("2025-03-20"))).toBe("1403-12"); // 30th of Esfand, leap 1403
    expect(jalaliMonthKey(fromISODate("2025-03-21"))).toBe("1404-01"); // Nowruz 1404
    expect(jalaliMonthKey(fromISODate("2026-08-22"))).toBe("1405-05"); // 31st of Mordad
    expect(jalaliMonthKey(fromISODate("2026-08-23"))).toBe("1405-06"); // 1st of Shahrivar
  });

  it("produces zero-padded, lexically sortable keys", () => {
    const key = jalaliMonthKey(fromISODate("2026-09-06"));
    expect(key).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
    expect(key < "1405-07" && key > "1405-05").toBe(true);
  });

  it("bounds the month: Shahrivar 1405 starts 2026-08-23, ends 2026-09-22", () => {
    const d = fromISODate("2026-09-06");
    expect(toISODate(startOfJalaliMonth(d))).toBe("2026-08-23");
    expect(toISODate(endOfJalaliMonth(d))).toBe("2026-09-22"); // Shahrivar has 31 days
  });

  it("counts days: leap 1403 Esfand = 30, 1404/1405 Esfand = 29", () => {
    expect(jalaliDaysInMonth(fromISODate("2025-02-19"))).toBe(30); // 1403-12-01
    expect(jalaliDaysInMonth(fromISODate("2026-02-20"))).toBe(29); // 1404-12-01
    expect(jalaliDaysInMonth(fromISODate("2027-02-20"))).toBe(29); // 1405-12-01
    expect(jalaliDaysInMonth(fromISODate("2026-03-21"))).toBe(31); // Farvardin
    expect(jalaliDaysInMonth(fromISODate("2026-09-23"))).toBe(30); // Mehr
  });

  it("navigates months in the jalali calendar, clamping 30th of Esfand", () => {
    const leapEnd = fromISODate("2025-03-20"); // 1403-12-30
    // +1M keeps the day (Farvardin has 31): 1404-01-30
    expect(toISODate(addJalaliMonths(leapEnd, 1))).toBe("2025-04-19");
    // +12M clamps to the last day of non-leap 1404: 1404-12-29
    expect(toISODate(addJalaliMonths(leapEnd, 12))).toBe("2026-03-20");
    // ordinary navigation keeps the day-of-month: 1405-06-15 → 1405-07-15
    expect(toISODate(addJalaliMonths(fromISODate("2026-09-06"), 1))).toBe(
      "2026-10-07",
    );
  });
});

describe("currentJalaliMonthKey (Tehran-aware, ticket 14)", () => {
  it("uses the Tehran calendar day, not the server's UTC day", () => {
    // 2026-08-22 20:30 UTC = 2026-08-23 00:00 in Tehran → Shahrivar began
    expect(currentJalaliMonthKey(new Date(Date.UTC(2026, 7, 22, 20, 30)))).toBe(
      "1405-06",
    );
    // one hour earlier it is still 2026-08-22 22:30 in Tehran → Mordad
    expect(currentJalaliMonthKey(new Date(Date.UTC(2026, 7, 22, 19, 0)))).toBe(
      "1405-05",
    );
  });

  it("reads 'now' through the same Tehran lens by default", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(Date.UTC(2026, 7, 22, 20, 30));
      expect(currentJalaliMonthKey()).toBe("1405-06");
    } finally {
      vi.useRealTimers();
    }
  });
});
