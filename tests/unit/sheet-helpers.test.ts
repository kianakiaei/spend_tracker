import { describe, expect, it } from "vitest";
import { effectiveMonthKey, parseAmountInput, parseQuantityInput } from "@/components/expense-sheet/sheet-helpers";

// Ticket 27 — the pure edges of the expense sheet: parsing the amount field
// (any digit script, separators typed freely) and the month a save will land
// in (ticket 15/27: a picked date always wins; undated follows the form's
// month on create and the expense's own month on edit).

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
  it("a picked date always wins — even when it leaves the form's month", () => {
    // 2026-08-25 = 1405-06-03 (شهریور), form opened in مرداد
    expect(effectiveMonthKey("2026-08-25", "1405-05")).toBe("1405-06");
  });

  it("an undated create belongs to the form's month", () => {
    expect(effectiveMonthKey(null, "1405-05")).toBe("1405-05");
  });

  it("an undated edit stays in the month the expense already belongs to", () => {
    expect(effectiveMonthKey(null, "1405-05", "1405-03")).toBe("1405-03");
  });
});
