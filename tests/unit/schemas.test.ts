import { describe, expect, it } from "vitest";
import {
  amountTomanSchema,
  categoryKindSchema,
  dateOnlySchema,
  dayOfMonthSchema,
  jalaliMonthKeySchema,
  learnedKeySourceSchema,
  uuidv7Schema,
} from "@/lib/schemas";

// Domain constraint primitives from ticket 19 — the base every DTO (ticket 25)
// and service write (tickets 22-24) composes.

describe("jalaliMonthKeySchema", () => {
  it("accepts a Jalali month key like '1405-06'", () => {
    expect(jalaliMonthKeySchema.safeParse("1405-06").success).toBe(true);
  });

  it.each([
    "1405-6", // unpadded month
    "1405-13", // month out of range
    "1405-00", // zero month
    "1405/06", // wrong separator
    "140506", // missing separator
    "05-06", // missing year digits
  ])("rejects %s", (bad) => {
    expect(jalaliMonthKeySchema.safeParse(bad).success).toBe(false);
  });
});

describe("amountTomanSchema", () => {
  it("accepts a positive integer toman amount", () => {
    expect(amountTomanSchema.safeParse(250_000).success).toBe(true);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])("rejects %p", (
    bad,
  ) => {
    expect(amountTomanSchema.safeParse(bad).success).toBe(false);
  });
});

describe("dayOfMonthSchema", () => {
  it("accepts the Jalali day range 1..31", () => {
    expect(dayOfMonthSchema.safeParse(1).success).toBe(true);
    expect(dayOfMonthSchema.safeParse(31).success).toBe(true);
  });

  it.each([0, 32, 1.5, Number.NaN])("rejects %p", (bad) => {
    expect(dayOfMonthSchema.safeParse(bad).success).toBe(false);
  });
});

describe("dateOnlySchema", () => {
  it("accepts a Gregorian date-only string like '2026-09-06'", () => {
    expect(dateOnlySchema.safeParse("2026-09-06").success).toBe(true);
  });

  it.each([
    "2026-9-6", // unpadded
    "2026-13-01", // month out of range
    "2026-00-10", // zero month
    "2026-09-00", // zero day
    "2026-09-32", // day out of range
    "20260906", // missing separator
    "2026/09/06", // wrong separator
    "", // empty
  ])("rejects %s", (bad) => {
    expect(dateOnlySchema.safeParse(bad).success).toBe(false);
  });
});

describe("categoryKindSchema", () => {
  it("accepts 'system' and 'custom'", () => {
    expect(categoryKindSchema.safeParse("system").success).toBe(true);
    expect(categoryKindSchema.safeParse("custom").success).toBe(true);
  });

  it.each(["learned", "System", "default"])("rejects %s", (bad) => {
    expect(categoryKindSchema.safeParse(bad).success).toBe(false);
  });
});

describe("learnedKeySourceSchema", () => {
  it("accepts only 'learned' — system lexicon keys never enter the DB", () => {
    expect(learnedKeySourceSchema.safeParse("learned").success).toBe(true);
    expect(learnedKeySourceSchema.safeParse("system").success).toBe(false);
  });
});

describe("uuidv7Schema", () => {
  it("accepts a UUIDv7 string", () => {
    expect(
      uuidv7Schema.safeParse("0198f0e2-7b6a-7abc-9def-0123456789ab").success,
    ).toBe(true);
  });

  it.each([
    "3f2504e0-4f89-41d3-9a0c-0305e82c3301", // v4
    "not-a-uuid",
    "",
  ])("rejects %s", (bad) => {
    expect(uuidv7Schema.safeParse(bad).success).toBe(false);
  });
});
