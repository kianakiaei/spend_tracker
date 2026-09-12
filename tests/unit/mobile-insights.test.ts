import { describe, expect, it } from "vitest";

// Expo-mobile ticket 08 (Insights): the repeat-purchase board with top
// products, monthly average-unit-price trends, and per-product purchase
// history. Like tickets 02-07, the mobile core is pure TypeScript with
// injected seams (V1Client over an injected fetch), tested here at the
// highest seam — what the wire carries and what the view model holds — never
// component internals. The Expo screen in apps/mobile is a thin wrapper.
//
// Web parity (insights/page.tsx + insights-board.tsx + insights-service.ts):
// repeat titles group by the engine's canonical form, single purchases drop
// out, rows sort by count then total, the average is the weighted mean
// (جمع مبالغ ÷ جمع تعدادها) rounded to whole tomans, the monthly trend shows
// weighted averages with the overall average as reference, and history runs
// newest first.
//
// Frozen-API note (spec: no new endpoints): the web page reads the insights
// service directly (all-time rows). The frozen API exposes no insights read —
// only the month-scoped ledger — so mobile fans out expenses.listByMonth over
// the trailing 12 Jalali months and groups client-side with the shared
// canonical + quantity helpers. The board labels the window honestly
// («۱۲ ماه اخیر»); an all-time board needs a new frozen-API read.

import {
  INSIGHT_LIMIT,
  INSIGHT_MONTHS,
  INSIGHT_MESSAGES,
  buildProductInsights,
  historyFor,
  insightWindowKeys,
} from "../../apps/mobile/src/insights";
import {
  insightsKey,
  loadInsightsScreen,
} from "../../apps/mobile/src/insights-queries";
import { createV1Client } from "../../packages/shared/src/api/client";

// --- fixtures ---------------------------------------------------------------

function v7(n: number): string {
  return `01938f4a-7b1e-7a1e-8000-${String(n).padStart(12, "0")}`;
}

function category(id: number): Record<string, unknown> {
  return {
    id: v7(id),
    name: `دسته ${id}`,
    icon: null,
    color: null,
    kind: "custom",
    order: id,
    slug: null,
    userId: "user-1",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
}

function expense(
  id: number,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: v7(id),
    amountToman: 10000,
    quantity: 1,
    unit: "piece",
    title: `خرج ${id}`,
    note: null,
    categoryId: v7(1),
    occurredAt: "2026-08-25",
    monthKey: "1405-06",
    sourceRecurringId: null,
    eventId: null,
    userId: "user-1",
    createdAt: "2026-08-25T00:00:00.000Z",
    updatedAt: "2026-08-25T00:00:00.000Z",
    category: category(1),
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function mockFetch(
  respond: (url: string, init: RequestInit) => Response | Promise<Response>,
) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchFn = (async (input: unknown, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    return respond(String(input), calls[calls.length - 1]!.init);
  }) as typeof fetch;
  return { calls, fetchFn };
}

// --- window ------------------------------------------------------------------

describe("insights window (ticket 08)", () => {
  it("covers the trailing 12 Jalali months ending at the current month", () => {
    const keys = insightWindowKeys("1405-06");
    expect(INSIGHT_MONTHS).toBe(12);
    expect(keys).toHaveLength(12);
    expect(keys[11]).toBe("1405-06");
    expect(keys[0]).toBe("1404-07");
    // Ascending, oldest first.
    expect([...keys].sort()).toEqual(keys);
  });
});

// --- grouping ----------------------------------------------------------------

describe("product grouping (ticket 08)", () => {
  it("groups repeat titles by canonical form with weighted averages", () => {
    const products = buildProductInsights([
      expense(1, {
        title: "نان سنگک",
        amountToman: 10000,
        quantity: 2,
        monthKey: "1405-05",
        occurredAt: "2026-07-25",
      }),
      expense(2, {
        title: "نان سنگک",
        amountToman: 20000,
        quantity: 2,
        monthKey: "1405-06",
        occurredAt: "2026-08-25",
      }),
    ] as never);
    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      displayTitle: "نان سنگک",
      count: 2,
      totalToman: 30000,
      totalQuantity: 4,
      overallAvgUnit: 7500,
    });
  });

  it("folds Yeh, digit, and half-space variants into one product", () => {
    const products = buildProductInsights([
      expense(1, { title: "شير کم‌چرب", amountToman: 50000 }),
      expense(2, { title: "شیر کم چرب", amountToman: 50000 }),
      expense(3, { title: "شیر ۲ لیتری", amountToman: 60000 }),
      expense(4, { title: "شیر 2 لیتری", amountToman: 60000 }),
    ] as never);
    // Yeh/half-space variants fold into one product, digit variants into
    // another; single purchases would drop out (web parity).
    expect(products).toHaveLength(2);
    expect(products[0]).toMatchObject({ count: 2 });
    expect(products[1]).toMatchObject({ count: 2 });
  });

  it("drops single purchases and blank titles (web parity)", () => {
    const products = buildProductInsights([
      expense(1, { title: "نان سنگک" }),
      expense(2, { title: "نان سنگک" }),
      expense(3, { title: "یک‌بارمصرف" }),
      expense(4, { title: "   " }),
    ] as never);
    expect(products).toHaveLength(1);
    expect(products[0]!.displayTitle).toBe("نان سنگک");
  });

  it("sorts by count then total and caps at 20 (web parity)", () => {
    expect(INSIGHT_LIMIT).toBe(20);
    const rows = [];
    for (let i = 1; i <= 3; i++)
      rows.push(
        expense(i, { title: "کم‌تکرار", amountToman: 1000 }),
        expense(10 + i, { title: "پرتکرار", amountToman: 1000 }),
      );
    rows.push(expense(99, { title: "پرتکرار", amountToman: 1000 }));
    const products = buildProductInsights(rows as never);
    expect(products[0]!.displayTitle).toBe("پرتکرار");
    expect(products[0]!.count).toBe(4);
    expect(products[1]!.count).toBe(3);
  });

  it("defaults a missing quantity to 1 like the services", () => {
    const products = buildProductInsights([
      expense(1, { title: "نان", amountToman: 10000, quantity: null }),
      expense(2, { title: "نان", amountToman: 20000, quantity: 2 }),
    ] as never);
    expect(products[0]).toMatchObject({
      totalQuantity: 3,
      overallAvgUnit: 10000,
    });
  });

  it("speaks the web board's Persian voice for the empty state", () => {
    expect(INSIGHT_MESSAGES.emptyList).toContain("خرید تکراری");
    expect(INSIGHT_MESSAGES.noFilterHits).toContain("محصولی");
  });
});

// --- monthly trend + history -------------------------------------------------

describe("monthly trend and history (ticket 08)", () => {
  function board() {
    return buildProductInsights([
      expense(1, {
        title: "نان",
        amountToman: 10000,
        quantity: 2,
        monthKey: "1405-05",
        occurredAt: "2026-07-25",
      }),
      expense(2, {
        title: "نان",
        amountToman: 30000,
        quantity: 2,
        monthKey: "1405-06",
        occurredAt: "2026-08-25",
      }),
    ] as never)[0]!;
  }

  it("buckets weighted monthly averages ascending for the trend", () => {
    const product = board();
    expect(product.monthly).toEqual([
      { monthKey: "1405-05", count: 1, avgUnitPrice: 5000 },
      { monthKey: "1405-06", count: 1, avgUnitPrice: 15000 },
    ]);
    // The overall average is the trend's dashed reference.
    expect(product.overallAvgUnit).toBe(10000);
  });

  it("lists purchase history newest first (web parity)", () => {
    const product = board();
    const history = historyFor(product);
    expect(history.map((p) => p.expenseId)).toEqual([v7(2), v7(1)]);
  });
});

// --- loader over the frozen API ----------------------------------------------

describe("insights loader (ticket 08)", () => {
  it("fans out the month ledger over the trailing window and groups client-side", async () => {
    const { calls, fetchFn } = mockFetch((url) => {
      if (url.startsWith("/api/v1/expenses?month=")) {
        const month = new URL(url, "http://x").searchParams.get("month");
        if (month === "1405-06")
          return jsonResponse([
            expense(1, { title: "نان", amountToman: 10000 }),
            expense(2, { title: "نان", amountToman: 20000 }),
          ]);
        return jsonResponse([]);
      }
      throw new Error(`unexpected ${url}`);
    });
    const client = createV1Client({ fetchFn });
    const screen = await loadInsightsScreen(client as never, "1405-06");
    expect(screen.monthKeys).toHaveLength(12);
    // One ledger read per window month — the only frozen-API path to rows.
    expect(
      calls.filter((call) => call.url.startsWith("/api/v1/expenses")),
    ).toHaveLength(12);
    const products = buildProductInsights(screen.expenses as never);
    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      displayTitle: "نان",
      count: 2,
    });
    expect(insightsKey()).toEqual(["insights"]);
  });

  it("is honest about an empty window", async () => {
    const { fetchFn } = mockFetch(() => jsonResponse([]));
    const client = createV1Client({ fetchFn });
    const screen = await loadInsightsScreen(client as never, "1405-06");
    expect(screen.expenses).toEqual([]);
    expect(buildProductInsights(screen.expenses as never)).toEqual([]);
  });
});
