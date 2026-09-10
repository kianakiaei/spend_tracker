import { describe, expect, it } from "vitest";
import {
  defaultCreateDate,
  effectiveMonthKey,
  parseAmountInput,
  parseQuantityInput,
} from "@/components/expense-sheet/sheet-helpers";
import {
  currentJalaliMonthKey,
  currentTehranISODate,
  fromJalaliMonthKey,
  toISODate,
  shiftJalaliMonthKey,
} from "@/lib/jalali";

describe("parseAmountInput", () => {
  it("reads Latin digits", () => {
    expect(parseAmountInput("1234500")).toBe(1234500);
  });

  it("reads Persian and Arabic-Indic digits", () => {
    expect(parseAmountInput("۱۲۳۴۵۰")).toBe(123450);
    expect(parseAmountInput("١٢٣٤٥")).toBe(12345);
  });

  it("ignores separators and stray characters typed around the digits", () => {
    expect(parseAmountInput("۱٬۲۳۴٬۵۰۰")).toBe(1234500);
    expect(parseAmountInput(" 12,00 ")).toBe(1200);
  });

  it("is null while there is no positive integer", () => {
    expect(parseAmountInput("")).toBeNull();
    expect(parseAmountInput("۰")).toBeNull();
    expect(parseAmountInput("۰۰")).toBeNull();
    expect(parseAmountInput("abc")).toBeNull();
  });
});

describe("parseQuantityInput", () => {
  it("reads whole and fractional quantities in any digit script", () => {
    expect(parseQuantityInput("3")).toBe(3);
    expect(parseQuantityInput("2.5")).toBe(2.5);
    expect(parseQuantityInput("۲٫۵")).toBe(2.5);
    expect(parseQuantityInput("۰٫۵")).toBe(0.5);
  });

  it("ignores group separators around the number", () => {
    expect(parseQuantityInput(" 1٬۰۰۰ ")).toBe(1000);
  });

  it("is null while empty or beyond 3 decimals", () => {
    expect(parseQuantityInput("")).toBeNull();
    expect(parseQuantityInput("۰")).toBeNull();
    expect(parseQuantityInput("2.5555")).toBeNull();
    expect(parseQuantityInput("abc")).toBeNull();
  });
});

describe("effectiveMonthKey", () => {
  it("is the Jalali month of the picked date", () => {
    expect(effectiveMonthKey("2026-08-25")).toBe("1405-06");
  });
});

describe("defaultCreateDate", () => {
  it("uses today in the current Jalali month", () => {
    expect(defaultCreateDate(currentJalaliMonthKey())).toBe(currentTehranISODate());
  });

  it("uses the first day of another Jalali month", () => {
    const other = shiftJalaliMonthKey(currentJalaliMonthKey(), -1);
    expect(defaultCreateDate(other)).toBe(toISODate(fromJalaliMonthKey(other)));
  });
});
