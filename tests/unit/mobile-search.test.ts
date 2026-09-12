import { describe, expect, it } from "vitest";

// Expo-mobile ticket 07 (Search): whole-ledger title search with the same
// Persian normalization the categorization engine uses, hit metadata
// (amount, Jalali occurrence month, category), and tap-to-edit in the shared
// Expense sheet. Like tickets 02-06, the mobile core is pure TypeScript with
// injected seams (V1Client over an injected fetch), tested here at the
// highest seam — what the wire carries and what the view model holds — never
// component internals. The Expo Router screen in apps/mobile is a thin
// wrapper.
//
// Web parity (search/page.tsx + search-board.tsx): the server applies the
// shared canonical rule to the fetched page and the board narrows live as the
// user types; a click opens the same edit sheet as the home ledger. Mobile
// queries GET /api/v1/search?q= per debounced keystroke (the frozen API has
// no listAll read) and narrows the fetched page client-side with the same
// canonical rule — شیر finds شير either way.

import {
  SEARCH_MESSAGES,
  buildSearchViewModel,
  narrowHits,
  toSheetExpenseRef,
} from "../../apps/mobile/src/search";
import {
  loadSearchScreen,
  searchKey,
} from "../../apps/mobile/src/search-queries";
import { createV1Client } from "../../packages/shared/src/api/client";

// --- fixtures ---------------------------------------------------------------

function v7(n: number): string {
  return `01938f4a-7b1e-7a1e-8000-${String(n).padStart(12, "0")}`;
}

function hit(
  id: number,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    expenseId: v7(id),
    title: `شیر ${id}`,
    amountToman: 50000,
    quantity: 1,
    unit: "piece",
    monthKey: "1405-06",
    occurredAt: "2026-08-25",
    categoryName: "خوراکی",
    categoryId: v7(1),
    eventTitle: null,
    eventId: null,
    sourceRecurringId: null,
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

// --- client-side narrowing (web parity) -------------------------------------

describe("search narrowing (ticket 07)", () => {
  const hits = [
    hit(1, { title: "شیر کم‌چرب" }),
    hit(2, { title: "نان سنگک" }),
  ] as never[];

  it("matches across Yeh variants with the engine's canonical form", () => {
    // «شير» with an Arabic Yeh still finds «شیر».
    expect(narrowHits(hits, "شير")).toHaveLength(1);
    expect(narrowHits(hits, "شیر")).toHaveLength(1);
  });

  it("matches across digit variants", () => {
    const priced = [hit(3, { title: "شیر ۲ لیتری" })] as never[];
    expect(narrowHits(priced, "شیر 2 لیتری")).toHaveLength(1);
  });

  it("matches across half-space variants", () => {
    expect(narrowHits(hits, "کم چرب")).toHaveLength(1);
    expect(narrowHits(hits, "کم‌چرب")).toHaveLength(1);
  });

  it("returns every hit while the query is blank", () => {
    expect(narrowHits(hits, "")).toHaveLength(2);
    expect(narrowHits(hits, "   ")).toHaveLength(2);
  });
});

// --- view model --------------------------------------------------------------

describe("search view model (ticket 07)", () => {
  it("shows amount, Jalali occurrence month, and category per hit", () => {
    const vm = buildSearchViewModel({
      hits: [hit(1, { title: "شیر", amountToman: 1500000 })] as never,
    });
    expect(vm.rows).toHaveLength(1);
    const row = vm.rows[0]!;
    expect(row.title).toBe("شیر");
    expect(row.categoryName).toBe("خوراکی");
    // Persian digits + تومان, never Latin digits in the amount.
    expect(row.amountLabel).toContain("تومان");
    expect(row.amountLabel).not.toMatch(/[0-9]/);
    // The Jalali month of وقوع, not a Gregorian date.
    expect(row.monthLabel).toContain("شهریور");
    expect(row.monthLabel).not.toMatch(/[0-9]/);
  });

  it("carries the event title through when the خرج belongs to a رویداد", () => {
    const vm = buildSearchViewModel({
      hits: [hit(1, { eventTitle: "سفر اصفهان" })] as never,
    });
    expect(vm.rows[0]!.eventTitle).toBe("سفر اصفهان");
  });

  it("maps a hit to the shared Expense edit sheet ref (web toSheetExpense parity)", () => {
    const ref = toSheetExpenseRef(
      hit(7, {
        title: "شیر",
        amountToman: 80000,
        quantity: 2,
        unit: "kilo",
        occurredAt: "2026-08-20",
        monthKey: "1405-05",
        categoryId: v7(3),
        eventId: v7(4),
        sourceRecurringId: v7(5),
      }) as never,
    );
    expect(ref).toMatchObject({
      id: v7(7),
      title: "شیر",
      amountToman: 80000,
      quantity: 2,
      unit: "kilo",
      occurredAt: "2026-08-20",
      categoryId: v7(3),
      eventId: v7(4),
      sourceRecurringId: v7(5),
    });
  });

  it("speaks the web board's Persian voice for empty states", () => {
    expect(SEARCH_MESSAGES.emptyQuery).toContain("بخشی از عنوان");
    expect(SEARCH_MESSAGES.noHits).toContain("خرجی با این عنوان پیدا نشد");
  });
});

// --- loader over the frozen API ----------------------------------------------

describe("search loader (ticket 07)", () => {
  function wire(hits: unknown[]) {
    return mockFetch((url) => {
      if (url.startsWith("/api/v1/search")) return jsonResponse(hits);
      if (url === "/api/v1/categories") return jsonResponse([]);
      if (url === "/api/v1/events") return jsonResponse([]);
      throw new Error(`unexpected ${url}`);
    });
  }

  it("queries the frozen search endpoint with the typed query", async () => {
    const { calls, fetchFn } = wire([hit(1)]);
    const client = createV1Client({ fetchFn });
    const screen = await loadSearchScreen(client as never, "شیر");
    expect(screen.hits).toHaveLength(1);
    expect(screen.categories).toEqual([]);
    expect(screen.events).toEqual([]);
    const searchCall = calls.find((call) =>
      call.url.startsWith("/api/v1/search"),
    );
    expect(searchCall).toBeDefined();
    expect(decodeURIComponent(searchCall!.url)).toContain("q=شیر");
    expect(searchKey("شیر")).toEqual(["search", "شیر"]);
  });

  it("never touches the search endpoint while the query is blank (the server would answer [])", async () => {
    const { calls, fetchFn } = wire([hit(1)]);
    const client = createV1Client({ fetchFn });
    const screen = await loadSearchScreen(client as never, "   ");
    expect(screen.hits).toEqual([]);
    expect(
      calls.some((call) => call.url.startsWith("/api/v1/search")),
    ).toBe(false);
    // Categories + events still load so the edit sheet is ready.
    expect(
      calls.some((call) => call.url === "/api/v1/categories"),
    ).toBe(true);
  });

  it("surfaces the single error shape when the search fails", async () => {
    const { fetchFn } = mockFetch((url) => {
      if (url.startsWith("/api/v1/search"))
        return jsonResponse(
          { type: "/problems/unknown", title: "boom", status: 500 },
          500,
        );
      return jsonResponse([]);
    });
    const client = createV1Client({ fetchFn });
    await expect(loadSearchScreen(client as never, "شیر")).rejects.toThrow();
    expect(SEARCH_MESSAGES.loadFailed).toContain("سرور");
  });
});
