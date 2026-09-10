import { describe, expect, it } from "vitest";
import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import { isoDateFromPicker } from "@/components/expense-sheet/picker-iso";

describe("isoDateFromPicker", () => {
  it("reads Ordibehesht 1 as Gregorian 2026-04-21 from calendar parts", () => {
    const value = new DateObject({
      year: 1405,
      month: 2,
      day: 1,
      calendar: persian,
    });
    expect(isoDateFromPicker(value)).toBe("2026-04-21");
    // convert must not mutate the picker's calendar
    expect(value.format()).toBe("1405/02/01");
  });
});
