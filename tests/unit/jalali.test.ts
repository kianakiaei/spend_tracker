import { describe, expect, it, vi } from "vitest";
import {
  addJalaliMonths,
  currentJalaliMonthKey,
  currentTehranISODate,
  endOfJalaliMonth,
  formatJalali,
  formatJalaliISODate,
  formatToman,
  fromISODate,
  fromJalaliMonthKey,
  jalaliDayLabel,
  jalaliDayOfMonth,
  jalaliDaysInMonth,
  jalaliIntlDate,
  jalaliMonthKey,
  jalaliMonthKeyLabel,
  jalaliMonthLabel,
  jalaliMonthNameFromKey,
  occurrenceISO,
  startOfJalaliMonth,
  shiftJalaliMonthKey,
  toEnglishDigits,
  toISODate,
  toPersianDigits,
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

  it("inverts: month key → a local-midnight Date inside that month (ticket 23)", () => {
    // 1405-06-01 is Gregorian 2026-08-23 (Shahrivar starts)
    expect(toISODate(fromJalaliMonthKey("1405-06"))).toBe("2026-08-23");
    expect(toISODate(fromJalaliMonthKey("1405-01"))).toBe("2026-03-21"); // Nowruz
    // round-trip holds for every anchor month
    for (const key of ["1403-12", "1404-06", "1405-06", "1405-12"]) {
      expect(jalaliMonthKey(fromJalaliMonthKey(key))).toBe(key);
    }
  });

  it("rejects a malformed month key", () => {
    expect(() => fromJalaliMonthKey("1405-6")).toThrow(RangeError);
    expect(() => fromJalaliMonthKey("140506")).toThrow(RangeError);
    expect(() => fromJalaliMonthKey("")).toThrow(RangeError);
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

describe("currentTehranISODate (Tehran-aware, ticket 27)", () => {
  it("gives the Tehran calendar day as a Gregorian date-only string", () => {
    // 2026-08-22 20:30 UTC = 2026-08-23 00:00 in Tehran — the pair of
    // currentJalaliMonthKey above, so the sheet's «today» default and the
    // current-month comparison can never disagree.
    expect(currentTehranISODate(new Date(Date.UTC(2026, 7, 22, 20, 30)))).toBe(
      "2026-08-23",
    );
    expect(currentTehranISODate(new Date(Date.UTC(2026, 7, 22, 19, 0)))).toBe(
      "2026-08-22",
    );
  });

  it("reads 'now' through the same Tehran lens by default", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(Date.UTC(2026, 7, 22, 20, 30));
      expect(currentTehranISODate()).toBe("2026-08-23");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("jalali display (fa-IR)", () => {
  const shahrivar15 = fromISODate("2026-09-06"); // 1405-06-15, a Sunday

  it("formats jalali dates with Persian digits by default", () => {
    expect(formatJalali(shahrivar15)).toBe("۱۴۰۵/۰۶/۱۵");
    expect(formatJalali(shahrivar15, "yyyy-MM-dd")).toBe("۱۴۰۵-۰۶-۱۵");
  });

  it("labels the month as 'name + year' and the day as 'weekday + day + month'", () => {
    expect(jalaliMonthLabel(shahrivar15)).toBe("شهریور ۱۴۰۵");
    expect(jalaliMonthLabel(fromISODate("2026-03-21"))).toBe("فروردین ۱۴۰۵");
    expect(jalaliMonthKeyLabel("1405-06")).toBe("شهریور ۱۴۰۵");
    expect(jalaliMonthKeyLabel("1405-02")).toBe("اردیبهشت ۱۴۰۵");
    expect(jalaliMonthKeyLabel("1405-01")).toBe("فروردین ۱۴۰۵");
    expect(jalaliMonthNameFromKey("1405-06")).toBe("شهریور");
    expect(formatJalaliISODate("2026-09-06")).toBe("۱۵ شهریور ۱۴۰۵");
    expect(formatJalaliISODate("2026-08-23")).toBe("۱ شهریور ۱۴۰۵");
    expect(jalaliDayLabel(shahrivar15)).toBe("یک‌شنبه ۱۵ شهریور");
  });

  it("renders the canonical full date via ICU's persian calendar", () => {
    expect(jalaliIntlDate(shahrivar15)).toBe("۱۴۰۵ شهریور ۱۵, یکشنبه");
  });

  it("maps digits both ways, including Arabic-Indic input", () => {
    expect(toPersianDigits(1234567)).toBe("۱۲۳۴۵۶۷");
    expect(toPersianDigits("1405-06")).toBe("۱۴۰۵-۰۶");
    expect(toPersianDigits("خرید 3x")).toBe("خرید ۳x");
    expect(toEnglishDigits("۱۴۰۵/۰۶/۱۵")).toBe("1405/06/15");
    expect(toEnglishDigits("٤٥٦")).toBe("456");
    expect(toEnglishDigits("۱٬۲۳۴ t")).toBe("1٬234 t");
  });

  it("formats toman amounts with Persian digits and the toman suffix", () => {
    expect(formatToman(1234567)).toBe("۱٬۲۳۴٬۵۶۷ تومان");
    expect(formatToman(950000)).toBe("۹۵۰٬۰۰۰ تومان");
    expect(formatToman(0)).toBe("۰ تومان");
  });
});

describe("wide-range properties (1996–2060, research 04 checklist)", () => {
  const start = new Date(1996, 0, 1);
  const end = new Date(2060, 11, 31);
  const everyDay = () => {
    const days: Date[] = [];
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }
    return days;
  };

  it("round-trips every Gregorian date-only string through local midnight", () => {
    for (const d of everyDay()) {
      const iso = toISODate(d);
      expect(toISODate(fromISODate(iso)), iso).toBe(iso);
    }
  });

  it("agrees with ICU's persian calendar on every month key", () => {
    // two independent engines: jalaali-js (behind date-fns-jalali) vs ICU
    // (behind Intl) — a disagreement would corrupt monthly grouping
    const icu = new Intl.DateTimeFormat("en-u-ca-persian", {
      year: "numeric",
      month: "2-digit",
    });
    for (const d of everyDay()) {
      const parts = icu.formatToParts(d);
      const year = parts.find((p) => p.type === "year")!.value;
      const month = parts.find((p) => p.type === "month")!.value;
      expect(jalaliMonthKey(d), toISODate(d)).toBe(`${year}-${month}`);
    }
  });
});

describe("shiftJalaliMonthKey (month navigation, ticket 26)", () => {
  it("shifts within the year, zero-padded", () => {
    expect(shiftJalaliMonthKey("1405-06", 1)).toBe("1405-07");
    expect(shiftJalaliMonthKey("1405-06", -1)).toBe("1405-05");
    expect(shiftJalaliMonthKey("1405-03", -2)).toBe("1405-01");
  });

  it("wraps across the year boundary in both directions", () => {
    expect(shiftJalaliMonthKey("1405-12", 1)).toBe("1406-01");
    expect(shiftJalaliMonthKey("1405-01", -1)).toBe("1404-12");
    expect(shiftJalaliMonthKey("1405-12", 14)).toBe("1407-02");
  });

  it("stays an exact inverse over a two-year walk", () => {
    let key = "1405-06";
    for (let i = 0; i < 24; i++) key = shiftJalaliMonthKey(key, 1);
    expect(key).toBe("1407-06");
  });

  it("rejects keys that are not jalali month keys", () => {
    expect(() => shiftJalaliMonthKey("1405-13", 1)).toThrow(RangeError);
    expect(() => shiftJalaliMonthKey("junk", 1)).toThrow(RangeError);
  });
});

describe("jalaliDayOfMonth (ledger interleaving, ticket 26)", () => {
  it("gives the jalali day as a latin number", () => {
    expect(jalaliDayOfMonth(fromISODate("2026-09-06"))).toBe(15);
    expect(jalaliDayOfMonth(fromISODate("2026-03-21"))).toBe(1); // 1 فروردین ۱۴۰۵
  });
});

describe("occurrenceISO (shared day-math, ticket 11)", () => {
  it("resolves the first of the month to its Gregorian start", () => {
    expect(occurrenceISO("1405-06", 1)).toBe("2026-08-23");
  });

  it("walks forward inside the month", () => {
    expect(occurrenceISO("1405-06", 15)).toBe("2026-09-06");
  });

  it("clamps long days to the month's last day", () => {
    expect(occurrenceISO("1404-12", 31)).toBe(occurrenceISO("1404-12", 29));
  });
});
