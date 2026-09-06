import { describe, expect, it } from "vitest";
import { fromISODate, toISODate } from "@/lib/jalali";

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
