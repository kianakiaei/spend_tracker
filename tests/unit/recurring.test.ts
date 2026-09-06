import { describe, expect, it } from "vitest";
import {
  clampedDayOfMonth,
  isTemplateDueInMonth,
  jalaliMonthBounds,
  monthPosition,
  occurrenceISO,
  toForecastRow,
  type RecurringWindow,
} from "@/lib/recurring";

// Pure recurring-template logic (ticket 23): the due-in-month predicate, the
// day clamp, the occurrence date and the month gates shared between ensure
// (lazy generation, decision 14) and preview (forecast, decision 15). All
// Gregorian anchors verified against date-fns-jalali.

const due = (over: Partial<RecurringWindow>): RecurringWindow => ({
  active: true,
  startDate: "2025-01-01",
  endDate: null,
  ...over,
});

describe("jalaliMonthBounds", () => {
  it("gives the Gregorian date-only span of a Jalali month", () => {
    // Shahrivar 1405: 31 days, 2026-08-23 .. 2026-09-22
    expect(jalaliMonthBounds("1405-06")).toEqual({
      startISO: "2026-08-23",
      endISO: "2026-09-22",
      daysInMonth: 31,
    });
    // non-leap Esfand 1405: 29 days
    expect(jalaliMonthBounds("1405-12").daysInMonth).toBe(29);
    expect(jalaliMonthBounds("1405-12").endISO).toBe("2027-03-20");
    // leap Esfand 1403: 30 days
    expect(jalaliMonthBounds("1403-12").daysInMonth).toBe(30);
    expect(jalaliMonthBounds("1403-12").endISO).toBe("2025-03-20");
  });

  it("rejects a malformed month key", () => {
    expect(() => jalaliMonthBounds("1405-6")).toThrow(RangeError);
    expect(() => jalaliMonthBounds("garbage")).toThrow(RangeError);
  });
});

describe("isTemplateDueInMonth — the shared predicate (decision 14)", () => {
  const MONTH = "1405-06"; // 2026-08-23 .. 2026-09-22

  it("accepts a template that started before the month, no end", () => {
    expect(isTemplateDueInMonth(due({}), MONTH)).toBe(true);
  });

  it("accepts the month-boundary edges: starts/ends exactly on them", () => {
    expect(isTemplateDueInMonth(due({ startDate: "2026-08-23" }), MONTH)).toBe(true);
    expect(isTemplateDueInMonth(due({ endDate: "2026-09-22" }), MONTH)).toBe(true);
    expect(isTemplateDueInMonth(due({ endDate: "2026-08-23" }), MONTH)).toBe(true);
  });

  it("rejects when startDate falls after the month ends", () => {
    expect(isTemplateDueInMonth(due({ startDate: "2026-09-23" }), MONTH)).toBe(false);
    // one day past Mehr's end (Mehr 1405 ends 2026-10-22)
    expect(isTemplateDueInMonth(due({ startDate: "2026-10-23" }), "1405-07")).toBe(false);
  });

  it("rejects when endDate closes before the month begins", () => {
    expect(isTemplateDueInMonth(due({ endDate: "2026-08-22" }), MONTH)).toBe(false);
  });

  it("rejects an inactive template regardless of the window", () => {
    expect(isTemplateDueInMonth(due({ active: false }), MONTH)).toBe(false);
  });

  it("accepts a template that starts inside the month (mid-month, decision 14)", () => {
    expect(isTemplateDueInMonth(due({ startDate: "2026-09-01" }), MONTH)).toBe(true);
  });
});

describe("clampedDayOfMonth — the day sticks to the month's last day", () => {
  it("keeps days the month has", () => {
    expect(clampedDayOfMonth(1, "1405-06")).toBe(1);
    expect(clampedDayOfMonth(31, "1405-06")).toBe(31); // Shahrivar has 31
    expect(clampedDayOfMonth(30, "1403-12")).toBe(30); // leap Esfand
  });

  it("clamps days 30/31 in a 29-day month (Esfand 1405)", () => {
    expect(clampedDayOfMonth(30, "1405-12")).toBe(29);
    expect(clampedDayOfMonth(31, "1405-12")).toBe(29);
  });

  it("clamps day 31 in a 30-day month", () => {
    expect(clampedDayOfMonth(31, "1405-07")).toBe(30); // Mehr has 30
  });
});

describe("occurrenceISO — the generated expense's occurredAt", () => {
  it("maps (monthKey, day) to the Gregorian date-only string", () => {
    expect(occurrenceISO("1405-06", 15)).toBe("2026-09-06");
    expect(occurrenceISO("1405-06", 1)).toBe("2026-08-23");
    expect(occurrenceISO("1405-06", 10)).toBe("2026-09-01");
  });

  it("clamps the day to the month's last day", () => {
    expect(occurrenceISO("1405-12", 31)).toBe("2027-03-20");
    expect(occurrenceISO("1403-12", 31)).toBe("2025-03-20");
  });
});

describe("monthPosition — the ensure/preview gates (decisions 14/15)", () => {
  it("classifies past, current and future against the reference month", () => {
    expect(monthPosition("1405-04", "1405-06")).toBe("past");
    expect(monthPosition("1405-06", "1405-06")).toBe("current");
    expect(monthPosition("1405-07", "1405-06")).toBe("future");
    expect(monthPosition("1404-12", "1405-01")).toBe("past");
    expect(monthPosition("1405-01", "1404-12")).toBe("future");
  });
});

describe("toForecastRow — the preview row shape (decision 15)", () => {
  it("maps a template onto the API contract row with the clamped day", () => {
    const row = toForecastRow(
      {
        id: "t1",
        title: "قسط وام",
        amountToman: 1_500_000,
        categoryId: "c1",
        dayOfMonth: 31,
      },
      "1405-12", // 29 days
    );
    expect(row).toEqual({
      templateId: "t1",
      title: "قسط وام",
      amountToman: 1_500_000,
      categoryId: "c1",
      day: 29,
    });
  });
});
