import { describe, expect, it, vi } from "vitest";

// Expo-mobile ticket 03 (Dashboard + Expense sheet tracer): the daily loop —
// Jalali month navigation with totals + forecast, per-category tiles, the
// interleaved recorded-plus-forecast ledger, and the Expense sheet state
// machine (create/edit/save-and-new/delete + suggestion badge + locked entry
// points). Like ticket 02, the mobile core is pure TypeScript with injected
// seams (V1Client over an injected fetch), tested here at the highest seam —
// what the wire carries and what the view model holds — never component
// internals. The Expo Router screens in apps/mobile are thin wrappers.

import {
  buildDashboardViewModel,
  shiftDashboardMonth,
} from "../../apps/mobile/src/dashboard";
import {
  EXPENSE_SHEET_MESSAGES,
  affectedMonthsForSave,
  buildCreatePayload,
  buildUpdatePayload,
  createSheetFormState,
  defaultCreateDate,
  deleteSheetExpense,
  effectiveMonthKey,
  fetchSuggestion,
  parseAmountInput,
  parseQuantityInput,
  pickSheetCategory,
  repeatNoticeFor,
  resolveActiveCategoryId,
  saveSheetCreate,
  saveSheetUpdate,
  shouldShowSuggestionBadge,
  validateExpenseForm,
} from "../../apps/mobile/src/expense-sheet";
import { resolveSheetVariant } from "../../apps/mobile/src/sheet";
import {
  affectedScopesForExpenseSave,
  categoriesScope,
  dashboardKey,
  eventsScope,
  insightsScope,
  invalidateDashboardScopes,
  loadDashboardMonth,
  searchScope,
} from "../../apps/mobile/src/queries";
import { createV1Client } from "../../packages/shared/src/api/client";
import {
  currentJalaliMonthKey,
  currentTehranISODate,
} from "../../packages/shared/src/jalali";

// --- fixtures ---------------------------------------------------------------

function v7(n: number): string {
  return `01938f4a-7b1e-7a1e-8000-${String(n).padStart(12, "0")}`;
}

function category(id: number, name: string, color: string | null = "#1a7a5c") {
  return {
    id: v7(id),
    name,
    icon: null,
    color,
    kind: "custom",
    order: id,
    slug: null,
    userId: "user-1",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

function expense(
  id: number,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: v7(id),
    amountToman: 100000,
    quantity: 1,
    unit: "piece",
    title: "نان",
    note: null,
    categoryId: v7(1),
    occurredAt: "2026-08-25",
    monthKey: "1405-06",
    sourceRecurringId: null,
    eventId: null,
    userId: "user-1",
    createdAt: "2026-08-25T00:00:00.000Z",
    updatedAt: "2026-08-25T00:00:00.000Z",
    category: category(1, "خوراک"),
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

// --- month navigator --------------------------------------------------------

describe("dashboard month navigator (ticket 03)", () => {
  it("shifts Jalali months unbounded in both directions", () => {
    expect(shiftDashboardMonth("1405-06", 1)).toBe("1405-07");
    expect(shiftDashboardMonth("1405-01", -1)).toBe("1404-12");
    expect(shiftDashboardMonth("1405-12", 1)).toBe("1406-01");
    // Unbounded: far past and far future are legitimate views.
    expect(shiftDashboardMonth("1405-06", -120)).toBe("1395-06");
    expect(shiftDashboardMonth("1405-06", 120)).toBe("1415-06");
  });

  it("rejects an invalid month key instead of navigating silently", () => {
    expect(() => shiftDashboardMonth("not-a-month", 1)).toThrow(RangeError);
  });
});

// --- dashboard view model ---------------------------------------------------

describe("dashboard view model (ticket 03)", () => {
  const cats = [category(1, "خوراک"), category(2, "حمل‌ونقل")] as never[];
  const summary = {
    monthKey: "1405-06",
    totalToman: 500000,
    byCategory: [
      { categoryId: v7(1), name: "خوراک", totalToman: 400000, count: 4 },
      { categoryId: v7(2), name: "حمل‌ونقل", totalToman: 100000, count: 1 },
    ],
    forecastToman: 200000,
  } as never;

  it("carries the month totals plus the forecast total with a Jalali label", () => {
    const vm = buildDashboardViewModel({
      monthKey: "1405-06",
      summary,
      expenses: [],
      forecast: [],
      categories: cats,
    });
    expect(vm.monthKey).toBe("1405-06");
    expect(vm.totalToman).toBe(500000);
    expect(vm.forecastToman).toBe(200000);
    expect(vm.monthLabel).toContain("شهریور");
  });

  it("sizes per-category tiles by share, largest first, linking to the drilldown", () => {
    const vm = buildDashboardViewModel({
      monthKey: "1405-06",
      summary,
      expenses: [],
      forecast: [],
      categories: cats,
    });
    expect(vm.tiles.map((t) => t.categoryId)).toEqual([v7(1), v7(2)]);
    expect(vm.tiles[0]).toMatchObject({ share: 0.8, drilldown: `/categories/${v7(1)}` });
    expect(vm.tiles[1]).toMatchObject({ share: 0.2 });
  });

  it("interleaves recorded and forecast rows on the Jalali day, recorded first on ties", () => {
    const expenses = [
      expense(11, { occurredAt: "2026-09-19", title: "ثبت‌شده" }),
      expense(12, { occurredAt: "2026-08-25", title: "زودتر" }),
    ] as never[];
    const forecast = [
      { templateId: v7(21), title: "پیش‌بینی اجاره", amountToman: 300000, categoryId: v7(2), day: 28 },
    ] as never[];
    const vm = buildDashboardViewModel({
      monthKey: "1405-06",
      summary,
      expenses,
      forecast,
      categories: cats,
    });
    expect(vm.ledger.map((row) => row.kind)).toEqual(["expense", "expense", "forecast"]);
    // Day tie (28): the recorded row comes before the forecast row.
    expect(vm.ledger[1]).toMatchObject({ kind: "expense", day: 28 });
    expect(vm.ledger[2]).toMatchObject({ kind: "forecast", day: 28, badge: "پیش‌بینی" });
  });

  it("badges every forecast row as an estimate and flags template-generated rows", () => {
    const expenses = [
      expense(11, { sourceRecurringId: v7(21), title: "از الگو" }),
    ] as never[];
    const vm = buildDashboardViewModel({
      monthKey: "1405-06",
      summary,
      expenses,
      forecast: [],
      categories: cats,
    });
    expect(vm.ledger[0]).toMatchObject({ kind: "expense", fromTemplate: true, badge: "از الگو" });
  });

  it("reports an empty month so the screen can render its honest empty note", () => {
    const vm = buildDashboardViewModel({
      monthKey: "1405-06",
      summary: { monthKey: "1405-06", totalToman: 0, byCategory: [] } as never,
      expenses: [],
      forecast: [],
      categories: cats,
    });
    expect(vm.isEmpty).toBe(true);
    expect(vm.tiles).toEqual([]);
    expect(vm.ledger).toEqual([]);
  });
});

// --- sheet field parsing (web parity) ---------------------------------------

describe("expense sheet parsing (ticket 03)", () => {
  it("reads whole-Toman amounts in any digit script, ignoring separators", () => {
    expect(parseAmountInput("1234500")).toBe(1234500);
    expect(parseAmountInput("۱۲۳۴۵۰")).toBe(123450);
    expect(parseAmountInput("۱٬۲۳۴٬۵۰۰")).toBe(1234500);
  });

  it("is null while the amount is not a positive whole Toman", () => {
    expect(parseAmountInput("")).toBeNull();
    expect(parseAmountInput("۰")).toBeNull();
    expect(parseAmountInput("abc")).toBeNull();
  });

  it("reads quantity with up to 3 decimals in any digit script", () => {
    expect(parseQuantityInput("3")).toBe(3);
    expect(parseQuantityInput("۲٫۵")).toBe(2.5);
    expect(parseQuantityInput(" 1٬۰۰۰ ")).toBe(1000);
  });

  it("is null while the quantity is empty or invalid", () => {
    expect(parseQuantityInput("")).toBeNull();
    expect(parseQuantityInput("2.5555")).toBeNull();
  });

  it("derives the ledger month from the occurrence date (never undated)", () => {
    expect(effectiveMonthKey("2026-08-25")).toBe("1405-06");
  });

  it("defaults a create date to today in the current month, else the month start", () => {
    expect(defaultCreateDate(currentJalaliMonthKey())).toBe(currentTehranISODate());
  });
});

// --- sheet validation + payload ---------------------------------------------

describe("expense sheet validation (ticket 03)", () => {
  function form(overrides: Record<string, unknown> = {}) {
    return {
      title: "نان",
      amountRaw: "100000",
      quantityRaw: "",
      unit: "piece",
      occurredAt: "2026-08-25",
      categoryId: v7(1),
      eventId: null,
      ...overrides,
    } as never;
  }

  it("saves a complete form: title, amount, mandatory date, category, optional event", () => {
    const checked = validateExpenseForm(form());
    expect(checked.canSave).toBe(true);
    expect(buildCreatePayload(form())).toMatchObject({
      title: "نان",
      amountToman: 100000,
      quantity: 1,
      unit: "piece",
      occurredAt: "2026-08-25",
      categoryId: v7(1),
      eventId: null,
    });
  });

  it("blocks save while the title, amount, or date is missing", () => {
    expect(validateExpenseForm(form({ title: "  " })).canSave).toBe(false);
    expect(validateExpenseForm(form({ amountRaw: "" })).canSave).toBe(false);
    expect(validateExpenseForm(form({ occurredAt: "" })).canSave).toBe(false);
    expect(buildCreatePayload(form({ title: "" }))).toBeNull();
  });

  it("keeps counted pieces whole while kilos may be fractional", () => {
    expect(validateExpenseForm(form({ quantityRaw: "2.5", unit: "piece" })).canSave).toBe(false);
    expect(validateExpenseForm(form({ quantityRaw: "2.5", unit: "kg" })).canSave).toBe(true);
    expect(buildCreatePayload(form({ quantityRaw: "0.5", unit: "kg" }))).toMatchObject({
      quantity: 0.5,
      unit: "kg",
    });
  });

  it("builds an update patch that keeps the month derived from the new date", () => {
    const patch = buildUpdatePayload(form({ occurredAt: "2026-09-23" }), {
      occurredAt: "2026-08-25",
    } as never);
    expect(patch).toMatchObject({ occurredAt: "2026-09-23" });
    expect(affectedMonthsForSave("2026-08-25", "2026-09-23")).toEqual(
      expect.arrayContaining(["1405-06", "1405-07"]),
    );
  });

  it("omits an unchanged date from the patch so the row cannot drift months", () => {
    const patch = buildUpdatePayload(form({ title: "نان سنگک" }), {
      occurredAt: "2026-08-25",
    } as never);
    expect(patch).toMatchObject({ title: "نان سنگک" });
    expect(patch).not.toHaveProperty("occurredAt");
  });

  it("keeps one affected month when the date does not move", () => {
    expect(affectedMonthsForSave("2026-08-25", "2026-08-25")).toEqual(["1405-06"]);
  });
});

// --- suggestion badge + locked entry points ---------------------------------

describe("expense sheet suggestion (ticket 03)", () => {
  const cats = [category(1, "خوراک"), category(2, "حمل‌ونقل")];

  it("shows the پیشنهاد badge until the user picks a category by hand", () => {
    expect(shouldShowSuggestionBadge(false)).toBe(true);
    expect(shouldShowSuggestionBadge(true)).toBe(false);
    expect(resolveActiveCategoryId({
      manual: false,
      pickedId: null,
      suggestionCategoryId: v7(2),
      categories: cats as never[],
    })).toBe(v7(2));
  });

  it("stays freely changeable: a hand pick wins and silences the engine", () => {
    const after = pickSheetCategory(
      { manual: false, pickedId: null } as never,
      v7(1),
    );
    expect(after.manual).toBe(true);
    expect(after.pickedId).toBe(v7(1));
    expect(resolveActiveCategoryId({
      manual: after.manual,
      pickedId: after.pickedId,
      suggestionCategoryId: v7(2),
      categories: cats as never[],
    })).toBe(v7(1));
  });

  it("honors the locked category and event entry points from drilldowns", () => {
    const state = createSheetFormState(
      { mode: "create", lockedCategoryId: v7(2), lockedEventId: v7(31) } as never,
      cats as never[],
      "1405-06",
    );
    expect(state.form.categoryId).toBe(v7(2));
    expect(state.form.eventId).toBe(v7(31));
    expect(state.manual).toBe(true);
    expect(shouldShowSuggestionBadge(state.manual)).toBe(false);
  });

  it("starts an edit from the row's own category (a fact, not a suggestion)", () => {
    const row = expense(11, { categoryId: v7(2) });
    const state = createSheetFormState({ mode: "edit", expense: row } as never, cats as never[], "1405-06");
    expect(state.form.categoryId).toBe(v7(2));
    expect(state.manual).toBe(true);
  });

  it("notices a repeat-generated row as independent yet freely editable", () => {
    expect(repeatNoticeFor({ sourceRecurringId: v7(21) } as never)).toBe(true);
    expect(repeatNoticeFor({ sourceRecurringId: null } as never)).toBe(false);
    expect(EXPENSE_SHEET_MESSAGES.fromTemplate).toContain("الگو");
  });

  it("looks the suggestion up on title blur, never for an empty title", async () => {
    const { calls, fetchFn } = mockFetch((url) => {
      expect(url).toBe("/api/v1/classify");
      return jsonResponse({ categoryId: v7(2), source: "learned", matchedKey: "شیر", confidence: null });
    });
    const client = createV1Client({ fetchFn });
    await expect(fetchSuggestion(client as never, "")).resolves.toBeNull();
    expect(calls).toHaveLength(0);
    const answer = await fetchSuggestion(client as never, "شیر");
    expect(answer).toMatchObject({ categoryId: v7(2) });
    expect(JSON.parse(String(calls[0]!.init.body))).toMatchObject({ title: "شیر" });
  });

  it("treats a failed lookup as no suggestion (save still works via fallback)", async () => {
    const { fetchFn } = mockFetch(() => new Response("<html>crash</html>", { status: 502 }));
    const client = createV1Client({ fetchFn });
    await expect(fetchSuggestion(client as never, "شیر")).resolves.toBeNull();
  });
});

// --- save / save-and-new / delete over the wire ------------------------------

describe("expense sheet persistence (ticket 03)", () => {
  it("creates with the full payload and lands in the date's month", async () => {
    const { calls, fetchFn } = mockFetch((url) => {
      expect(url).toBe("/api/v1/expenses");
      return jsonResponse(expense(11));
    });
    const client = createV1Client({ fetchFn });
    const created = await saveSheetCreate(client as never, {
      title: "نان",
      amountRaw: "100000",
      quantityRaw: "",
      unit: "piece",
      occurredAt: "2026-08-25",
      categoryId: v7(1),
      eventId: null,
    } as never);
    expect((created as { id: string }).id).toBe(v7(11));
    expect(JSON.parse(String(calls[0]!.init.body))).toMatchObject({
      title: "نان",
      amountToman: 100000,
      occurredAt: "2026-08-25",
    });
  });

  it("updates on edit and deletes with the row id (confirm stays a UI gate)", async () => {
    const { calls, fetchFn } = mockFetch((url) => {
      if (url === `/api/v1/expenses/${v7(11)}` && calls[calls.length - 1]!.init.method === "DELETE")
        return new Response(null, { status: 204 });
      return jsonResponse(expense(11, { title: "نان سنگک" }));
    });
    const client = createV1Client({ fetchFn });
    const updated = await saveSheetUpdate(client as never, v7(11), {
      title: "نان سنگک",
    } as never);
    expect((updated as { title: string }).title).toBe("نان سنگک");
    await deleteSheetExpense(client as never, v7(11));
    const deleted = calls[calls.length - 1]!;
    expect(deleted.url).toBe(`/api/v1/expenses/${v7(11)}`);
    expect(deleted.init.method).toBe("DELETE");
  });

  it("speaks one Persian voice when a save or delete fails", () => {
    expect(EXPENSE_SHEET_MESSAGES.saveFailed).toContain("ذخیره نشد");
    expect(EXPENSE_SHEET_MESSAGES.deleteFailed).toContain("حذف نشد");
    expect(EXPENSE_SHEET_MESSAGES.deleteConfirm).toContain("حذف شود");
  });
});

// --- universal sheet + query scopes ------------------------------------------

describe("universal sheet (ticket 03)", () => {
  it("renders the native bottom sheet on devices and the web primitive on expo web", () => {
    expect(resolveSheetVariant("ios")).toBe("native");
    expect(resolveSheetVariant("android")).toBe("native");
    expect(resolveSheetVariant("web")).toBe("web");
  });
});

describe("dashboard queries (ticket 03)", () => {
  const cats = [category(1, "خوراک")];
  const summary = { monthKey: "1405-06", totalToman: 100000, byCategory: [] };
  const forecast = [
    { templateId: v7(21), title: "اجاره", amountToman: 300000, categoryId: v7(1), day: 1 },
  ];

  function wire() {
    return mockFetch((url) => {
      if (url.startsWith("/api/v1/summaries")) return jsonResponse(summary);
      if (url.startsWith("/api/v1/expenses")) return jsonResponse([expense(11)]);
      if (url.startsWith("/api/v1/recurring-templates/preview")) return jsonResponse(forecast);
      if (url === "/api/v1/categories") return jsonResponse(cats);
      if (url === "/api/v1/events") return jsonResponse([]);
      throw new Error(`unexpected ${url}`);
    });
  }

  it("loads one month from the typed client (summary, ledger, categories, events)", async () => {
    const { fetchFn } = wire();
    const client = createV1Client({ fetchFn });
    const month = await loadDashboardMonth(client as never, "1405-06");
    expect(month.summary).toMatchObject({ monthKey: "1405-06" });
    expect(month.expenses).toHaveLength(1);
    expect(month.forecast).toHaveLength(1);
    expect(month.categories).toHaveLength(1);
    expect(dashboardKey("1405-06")).toEqual(["dashboard", "1405-06"]);
  });

  it("refreshes the affected month plus lists, summaries, and insights — no restart", async () => {
    const scopes = affectedScopesForExpenseSave({
      previousOccurredAt: "2026-08-25",
      nextOccurredAt: "2026-09-23",
    });
    expect(scopes.months).toEqual(expect.arrayContaining(["1405-06", "1405-07"]));
    expect(scopes.lists).toEqual(
      expect.arrayContaining([categoriesScope, eventsScope, searchScope, insightsScope]),
    );
    const invalidateQueries = vi.fn(async () => {});
    await invalidateDashboardScopes({ invalidateQueries } as never, scopes);
    // One invalidation per affected month plus the four list/insight scopes.
    expect(invalidateQueries.mock.calls.length).toBeGreaterThanOrEqual(6);
  });
});
