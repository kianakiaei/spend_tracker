import { describe, expect, it, vi } from "vitest";

// Expo-mobile ticket 04 (Categories + drilldown): full category management
// with usage counts, creation with color, rename including system ones,
// reordering, guarded deletion via move-expenses, and the drilldown with
// locked-category expense entry. Like tickets 02-03, the mobile core is pure
// TypeScript with injected seams (V1Client over an injected fetch), tested
// here at the highest seam — what the wire carries and what the view model
// holds — never component internals. The Expo Router screens in apps/mobile
// are thin wrappers.
//
// Frozen-API note (spec: no new endpoints): the web page reads all-time
// expense counts from a GROUP-BY service the API does not expose, so mobile
// shows per-month خرج counts from the month summary plus all-time الگو
// counts grouped from the templates list.

import {
  CATEGORY_MESSAGES,
  MOBILE_CATEGORY_SWATCHES,
  applyReorderLocal,
  buildCategoryDrilldown,
  buildCategoryListViewModel,
  buildCreateCategoryPayload,
  buildRenamePayload,
  countTemplatesByCategory,
  createCategory,
  moveCategoryExpensesThenRemove,
  moveTitleFor,
  removeCategory,
  renameCategory,
  reorderCategory,
  reorderPlan,
  validateCategoryName,
} from "../../apps/mobile/src/categories";
import {
  affectedScopesForCategoryMutation,
  categoriesKey,
  invalidateCategoryScopes,
  loadCategoriesScreen,
  loadCategoryDrilldown,
} from "../../apps/mobile/src/category-queries";
import { createSheetFormState } from "../../apps/mobile/src/expense-sheet";
import { createV1Client } from "../../packages/shared/src/api/client";

// --- fixtures ---------------------------------------------------------------

function v7(n: number): string {
  return `01938f4a-7b1e-7a1e-8000-${String(n).padStart(12, "0")}`;
}

function category(
  id: number,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: v7(id),
    name: `دسته ${id}`,
    icon: null,
    color: "#1a7a5c",
    kind: "custom",
    order: id,
    slug: null,
    userId: "user-1",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
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

// --- list view model ---------------------------------------------------------

describe("category list view model (ticket 04)", () => {
  it("sorts by display order and links each row to its drilldown", () => {
    const vm = buildCategoryListViewModel({
      categories: [
        category(2, { order: 2, name: "حمل‌ونقل" }),
        category(1, { order: 1, name: "خوراک" }),
      ] as never,
      expenseCounts: {},
      templateCounts: {},
    });
    expect(vm.rows.map((r) => r.name)).toEqual(["خوراک", "حمل‌ونقل"]);
    expect(vm.rows[0]).toMatchObject({ drilldown: `/category/${v7(1)}` });
  });

  it("labels a system category and refuses its deletion (rename stays free)", () => {
    const vm = buildCategoryListViewModel({
      categories: [category(1, { kind: "system", name: "خوراکی" })] as never,
      expenseCounts: { [v7(1)]: 5 },
      templateCounts: {},
    });
    expect(vm.rows[0]).toMatchObject({
      usageLabel: "دستهٔ سیستمی",
      deleteState: { kind: "blocked-system" },
    });
    expect(buildRenamePayload("  خوراک ")).toMatchObject({ name: "خوراک" });
  });

  it("labels an empty custom category as deletable, without claiming all-time emptiness", () => {
    const vm = buildCategoryListViewModel({
      categories: [category(9, { name: "ورزش" })] as never,
      expenseCounts: {},
      templateCounts: {},
    });
    expect(vm.rows[0]).toMatchObject({
      usageLabel: "بدون خرج در این ماه",
      deleteState: { kind: "allowed" },
      deleteHint: null,
    });
  });

  it("writes counts in Persian digits with the month scope stated", () => {
    const vm = buildCategoryListViewModel({
      categories: [category(1, { name: "خوراک" })] as never,
      expenseCounts: { [v7(1)]: 3 },
      templateCounts: { [v7(1)]: 2 },
    });
    expect(vm.rows[0]?.usageLabel).toBe("۳ خرج در این ماه · ۲ الگو");
  });

  it("explains every deletion guard in a clear error", () => {
    const vm = buildCategoryListViewModel({
      categories: [
        category(1, { kind: "system", name: "خوراکی" }),
        category(2, { name: "قسط" }),
        category(3, { name: "پُر" }),
      ] as never,
      expenseCounts: { [v7(1)]: 5, [v7(3)]: 3 },
      templateCounts: { [v7(2)]: 2 },
    });
    expect(vm.rows[0]?.deleteHint).toContain("سیستمی");
    expect(vm.rows[1]?.deleteHint).toContain("الگو");
    expect(vm.rows[2]?.deleteHint).toContain("منتقل");
  });

  it("guards a populated category: disabled delete plus the move shortcut", () => {
    const vm = buildCategoryListViewModel({
      categories: [category(1, { name: "خوراک" })] as never,
      expenseCounts: { [v7(1)]: 3 },
      templateCounts: {},
    });
    expect(vm.rows[0].deleteState).toMatchObject({
      kind: "needs-move",
      expenseCount: 3,
    });
  });

  it("blocks a template-pointed category with no move shortcut (move carries expenses only)", () => {
    const vm = buildCategoryListViewModel({
      categories: [category(1, { name: "قسط" })] as never,
      expenseCounts: {},
      templateCounts: { [v7(1)]: 2 },
    });
    expect(vm.rows[0].deleteState).toMatchObject({
      kind: "blocked-template",
      templateCount: 2,
    });
  });

  it("speaks one Persian voice for failures", () => {
    expect(CATEGORY_MESSAGES.saveFailed).toContain("انجام نشد");
    expect(CATEGORY_MESSAGES.deleteConfirm).toContain("حذف شود");
  });
});

// --- create / rename validation ----------------------------------------------

describe("category create/rename (ticket 04)", () => {
  it("offers a color swatch for a new custom bucket", () => {
    expect(MOBILE_CATEGORY_SWATCHES.length).toBeGreaterThanOrEqual(8);
    expect(MOBILE_CATEGORY_SWATCHES[0]).toMatchObject({ hex: "#1a7a5c" });
  });

  it("rejects a blank name without touching the wire", () => {
    expect(validateCategoryName("   ")).toBe(false);
    expect(validateCategoryName("ورزش")).toBe(true);
    expect(buildCreateCategoryPayload("  ", "#1a7a5c")).toBeNull();
    expect(buildRenamePayload("  ")).toBeNull();
  });

  it("builds a create payload with name, color, and a null icon", () => {
    expect(buildCreateCategoryPayload("ورزش", "#3da3c4")).toMatchObject({
      name: "ورزش",
      color: "#3da3c4",
      icon: null,
    });
  });

  it("creates over the wire with the trimmed name", async () => {
    const { calls, fetchFn } = mockFetch((url) => {
      expect(url).toBe("/api/v1/categories");
      return jsonResponse(category(9, { name: "ورزش" }));
    });
    const client = createV1Client({ fetchFn });
    const created = await createCategory(client as never, {
      name: "ورزش",
      color: "#3da3c4",
    });
    expect((created as { name: string }).name).toBe("ورزش");
    expect(JSON.parse(String(calls[0]!.init.body))).toMatchObject({
      name: "ورزش",
      color: "#3da3c4",
    });
  });

  it("renames any category over the wire, system ones included", async () => {
    const { calls, fetchFn } = mockFetch((url) => {
      expect(url).toBe(`/api/v1/categories/${v7(1)}`);
      return jsonResponse(category(1, { name: "خوراک من" }));
    });
    const client = createV1Client({ fetchFn });
    const updated = await renameCategory(client as never, v7(1), {
      name: "خوراک من",
    });
    expect((updated as { name: string }).name).toBe("خوراک من");
    expect(JSON.parse(String(calls[0]!.init.body))).toMatchObject({
      name: "خوراک من",
    });
  });

  it("carries a picked swatch in the same rename PATCH (ticket 12)", async () => {
    const { calls, fetchFn } = mockFetch((url) => {
      expect(url).toBe(`/api/v1/categories/${v7(1)}`);
      return jsonResponse(category(1, { name: "خوراک من", color: "#3da3c4" }));
    });
    const client = createV1Client({ fetchFn });
    await renameCategory(client as never, v7(1), {
      name: "خوراک من",
      color: "#3da3c4",
    });
    expect(JSON.parse(String(calls[0]!.init.body))).toMatchObject({
      name: "خوراک من",
      color: "#3da3c4",
    });
    expect(calls).toHaveLength(1);
  });
});

// --- reorder ------------------------------------------------------------------

describe("category reorder (ticket 04)", () => {
  const rows = [
    category(1, { order: 1 }),
    category(2, { order: 2 }),
    category(3, { order: 3 }),
  ] as Array<{ id: string; order: number }>;

  it("refuses to move past either end of the list", () => {
    expect(reorderPlan(rows, 0, -1)).toBeNull();
    expect(reorderPlan(rows, 2, 1)).toBeNull();
  });

  it("swaps orders with the neighbor through two PATCHes", async () => {
    const plan = reorderPlan(rows, 0, 1);
    expect(plan).not.toBeNull();
    expect(plan!.first).toMatchObject({ id: v7(1), order: 2 });
    expect(plan!.second).toMatchObject({ id: v7(2), order: 1 });

    const patched: Array<{ url: string; body: unknown }> = [];
    const { fetchFn } = mockFetch((url, init) => {
      patched.push({ url, body: JSON.parse(String(init.body)) });
      return jsonResponse(category(1));
    });
    const client = createV1Client({ fetchFn });
    await reorderCategory(client as never, plan!);
    expect(patched).toHaveLength(2);
    expect(patched[0]).toMatchObject({
      url: `/api/v1/categories/${v7(1)}`,
      body: { order: 2 },
    });
    expect(patched[1]).toMatchObject({
      url: `/api/v1/categories/${v7(2)}`,
      body: { order: 1 },
    });
  });

  it("swaps locally only after both PATCHes land", () => {
    const next = applyReorderLocal(rows, 0, 1);
    expect(next.map((r) => r.id)).toEqual([v7(2), v7(1), v7(3)]);
    // The source rows are untouched (no lying list on failure).
    expect(rows.map((r) => r.id)).toEqual([v7(1), v7(2), v7(3)]);
  });
});

// --- guarded deletion ----------------------------------------------------------

describe("guarded category deletion (ticket 04)", () => {
  it("deletes an empty category with its id", async () => {
    const { calls, fetchFn } = mockFetch((url, init) => {
      expect(url).toBe(`/api/v1/categories/${v7(9)}`);
      expect(init.method).toBe("DELETE");
      return new Response(null, { status: 204 });
    });
    const client = createV1Client({ fetchFn });
    await removeCategory(client as never, v7(9));
    expect(calls).toHaveLength(1);
  });

  it("titles the move shortcut with the source category", () => {
    expect(moveTitleFor("خوراک")).toContain("خوراک");
  });

  it("moves every expense then deletes the emptied category", async () => {
    const seen: string[] = [];
    const { fetchFn } = mockFetch((url, init) => {
      seen.push(`${init.method ?? "GET"} ${url}`);
      if (url.endsWith("/move-expenses")) return jsonResponse({ moved: 3 });
      return new Response(null, { status: 204 });
    });
    const client = createV1Client({ fetchFn });
    const result = await moveCategoryExpensesThenRemove(
      client as never,
      v7(1),
      v7(2),
    );
    expect(result).toMatchObject({ moved: 3 });
    // Move first (every خرج preserved), delete second.
    expect(seen).toEqual([
      `POST /api/v1/categories/${v7(1)}/move-expenses`,
      `DELETE /api/v1/categories/${v7(1)}`,
    ]);
  });

  it("groups all-time template counts from the templates list", () => {
    expect(
      countTemplatesByCategory([
        { categoryId: v7(1) },
        { categoryId: v7(1) },
        { categoryId: v7(2) },
      ] as never),
    ).toEqual({ [v7(1)]: 2, [v7(2)]: 1 });
  });
});

// --- drilldown ------------------------------------------------------------------

describe("category drilldown (ticket 04)", () => {
  const cats = [category(1, { name: "خوراک" }), category(2, { name: "قسط" })] as never[];
  const summary = {
    monthKey: "1405-06",
    totalToman: 500000,
    byCategory: [
      { categoryId: v7(1), name: "خوراک", totalToman: 400000, count: 4 },
    ],
  } as never;
  const expenses = [
    {
      id: v7(11),
      title: "نان",
      amountToman: 100000,
      quantity: 1,
      unit: "piece",
      occurredAt: "2026-08-25",
      categoryId: v7(1),
    },
    {
      id: v7(12),
      title: "اجاره",
      amountToman: 300000,
      quantity: 1,
      unit: "piece",
      occurredAt: "2026-08-25",
      categoryId: v7(2),
    },
  ] as never[];
  const forecast = [
    {
      templateId: v7(21),
      title: "قسط وام",
      amountToman: 200000,
      categoryId: v7(1),
      day: 5,
    },
  ] as never[];

  it("carries the panel: this category's total plus only its own rows", () => {
    const panel = buildCategoryDrilldown({
      monthKey: "1405-07",
      currentMonthKey: "1405-06",
      categoryId: v7(1),
      categories: cats,
      summary,
      expenses,
      forecast,
    });
    expect(panel.category).toMatchObject({ id: v7(1), name: "خوراک" });
    expect(panel.totalToman).toBe(400000);
    expect(panel.expenses.map((e) => e.id)).toEqual([v7(11)]);
    expect(panel.forecast.map((f) => f.templateId)).toEqual([v7(21)]);
    expect(panel.isEmpty).toBe(false);
  });

  it("reports an empty category so the screen renders its honest empty note", () => {
    const panel = buildCategoryDrilldown({
      monthKey: "1405-06",
      currentMonthKey: "1405-06",
      categoryId: v7(2),
      categories: cats,
      summary,
      expenses: [],
      forecast: [],
    });
    expect(panel.totalToman).toBe(0);
    expect(panel.isEmpty).toBe(true);
  });

  it("marks the composite total only for a future month with forecast rows", () => {
    const current = buildCategoryDrilldown({
      monthKey: "1405-06",
      currentMonthKey: "1405-06",
      categoryId: v7(1),
      categories: cats,
      summary,
      expenses,
      forecast,
    });
    // پیش‌بینی is display-only for future months: the current panel hides
    // forecast rows even if the wire ever carries them.
    expect(current.hasForecast).toBe(false);
    expect(current.forecast).toEqual([]);
    const future = buildCategoryDrilldown({
      monthKey: "1405-07",
      currentMonthKey: "1405-06",
      categoryId: v7(1),
      categories: cats,
      summary,
      expenses,
      forecast,
    });
    expect(future.hasForecast).toBe(true);
  });

  it("throws for an unknown category instead of rendering a stranger's panel", () => {
    expect(() =>
      buildCategoryDrilldown({
        monthKey: "1405-06",
        currentMonthKey: "1405-06",
        categoryId: v7(99),
        categories: cats,
        summary,
        expenses,
        forecast,
      }),
    ).toThrow();
  });

  it("keeps context: the drilldown add locks the expense sheet to this category", () => {
    const state = createSheetFormState(
      { mode: "create", lockedCategoryId: v7(1) } as never,
      cats as never,
      "1405-06",
    );
    expect(state.form.categoryId).toBe(v7(1));
    expect(state.manual).toBe(true);
  });
});

// --- loaders + invalidation ------------------------------------------------------

describe("category loaders (ticket 04)", () => {
  const cats = [category(1, { name: "خوراک" })];

  function wire() {
    return mockFetch((url) => {
      if (url === "/api/v1/categories") return jsonResponse(cats);
      if (url === "/api/v1/recurring-templates")
        return jsonResponse([
          {
            id: v7(21),
            title: "قسط",
            amountToman: 200000,
            categoryId: v7(1),
            dayOfMonth: 5,
            startDate: "2026-08-01",
            endDate: null,
            active: true,
            userId: "user-1",
            createdAt: "2026-08-01T00:00:00.000Z",
            updatedAt: "2026-08-01T00:00:00.000Z",
          },
        ]);
      if (url.startsWith("/api/v1/summaries"))
        return jsonResponse({
          monthKey: "1405-06",
          totalToman: 400000,
          byCategory: [
            { categoryId: v7(1), name: "خوراک", totalToman: 400000, count: 4 },
          ],
        });
      if (url.startsWith("/api/v1/expenses")) return jsonResponse([]);
      if (url === "/api/v1/events") return jsonResponse([]);
      if (url.startsWith("/api/v1/recurring-templates/preview"))
        return jsonResponse([]);
      throw new Error(`unexpected ${url}`);
    });
  }

  it("loads the list screen from the typed client (categories, templates, month summary)", async () => {
    const { fetchFn } = wire();
    const client = createV1Client({ fetchFn });
    const screen = await loadCategoriesScreen(client as never, "1405-06");
    expect(screen.categories).toHaveLength(1);
    expect(screen.templates).toHaveLength(1);
    expect(screen.summary).toMatchObject({ monthKey: "1405-06" });
    expect(categoriesKey()).toEqual(["categories"]);
  });

  it("loads one drilldown month (summary, ledger, forecast, categories, events)", async () => {
    const { fetchFn } = wire();
    const client = createV1Client({ fetchFn });
    const month = await loadCategoryDrilldown(client as never, "1405-06");
    expect(month.summary).toMatchObject({ monthKey: "1405-06" });
    expect(month.categories).toHaveLength(1);
  });

  it("refreshes lists and dashboards without restart after a category mutation", async () => {
    const scopes = affectedScopesForCategoryMutation();
    expect(scopes.lists).toEqual(expect.arrayContaining(["categories", "dashboard"]));
    const invalidateQueries = vi.fn(async () => {});
    await invalidateCategoryScopes({ invalidateQueries } as never, scopes);
    expect(invalidateQueries.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
