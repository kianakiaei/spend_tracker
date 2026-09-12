import { describe, expect, it, vi } from "vitest";

// Expo-mobile ticket 05 (Templates + Template sheet): recurring template
// management with pause/resume, jump to the generated expense of the month,
// three-month future preview, and the native Template bottom sheet for
// create/edit including backfill semantics. Like tickets 02-04, the mobile
// core is pure TypeScript with injected seams (V1Client over an injected
// fetch), tested here at the highest seam — what the wire carries and what
// the view model holds — never component internals. The Expo Router screens
// in apps/mobile are thin wrappers.
//
// Frozen-API note (spec: no new endpoints, no contract changes): the web
// templates page reads services directly; mobile reads the same frozen v1
// endpoints (recurring-templates list/preview, expenses listByMonth,
// categories list) and the server-side clamp/backfill stay server business.

import {
  PREVIEW_MONTHS,
  TEMPLATE_MESSAGES,
  buildCreateTemplatePayload,
  buildGeneratedThisMonth,
  buildTemplateListViewModel,
  buildTemplatePreviewSections,
  buildUpdateTemplatePayload,
  createTemplate,
  parseTemplateAmount,
  parseTemplateDay,
  pauseLabelFor,
  previewMonthKeys,
  rhythmLabelFor,
  saveTemplateUpdate,
  toggleTemplateActive,
  validateTemplateForm,
} from "../../apps/mobile/src/templates";
import {
  affectedScopesForTemplateMutation,
  invalidateTemplateScopes,
  loadTemplatesScreen,
  templatesKey,
} from "../../apps/mobile/src/template-queries";
import { createV1Client } from "../../packages/shared/src/api/client";

// --- fixtures ---------------------------------------------------------------

function v7(n: number): string {
  return `01938f4a-7b1e-7a1e-8000-${String(n).padStart(12, "0")}`;
}

function template(
  id: number,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: v7(id),
    title: `الگو ${id}`,
    amountToman: 200000,
    categoryId: v7(1),
    dayOfMonth: 5,
    startDate: "2026-08-01",
    endDate: null,
    active: true,
    userId: "user-1",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
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

// --- preview horizon ---------------------------------------------------------

describe("template preview horizon (ticket 05)", () => {
  it("covers the next three Jalali months", () => {
    expect(previewMonthKeys("1405-06")).toEqual(["1405-07", "1405-08", "1405-09"]);
    expect(PREVIEW_MONTHS).toBe(3);
  });

  it("crosses the Jalali year boundary", () => {
    expect(previewMonthKeys("1405-12")).toEqual(["1406-01", "1406-02", "1406-03"]);
  });

  it("builds preview sections with Persian month labels, skipping empty months", () => {
    const sections = buildTemplatePreviewSections({
      currentMonthKey: "1405-06",
      previews: [
        {
          monthKey: "1405-07",
          rows: [
            {
              templateId: v7(21),
              title: "قسط وام",
              amountToman: 200000,
              categoryId: v7(1),
              day: 5,
            },
          ],
        },
        { monthKey: "1405-08", rows: [] },
        { monthKey: "1405-09", rows: [] },
      ] as never,
    });
    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({ monthKey: "1405-07" });
    expect(sections[0]!.monthLabel).toContain("مهر");
    expect(sections[0]!.rows).toHaveLength(1);
  });

  it("drops an out-of-horizon preview even while it carries rows", () => {
    const sections = buildTemplatePreviewSections({
      currentMonthKey: "1405-06",
      previews: [
        { monthKey: "1405-07", rows: [] },
        { monthKey: "1405-10", rows: [{ templateId: v7(1) }] },
      ] as never,
    });
    expect(sections).toEqual([]);
  });

  it("reports an empty horizon so the screen hides the preview section", () => {
    const sections = buildTemplatePreviewSections({
      currentMonthKey: "1405-06",
      previews: [
        { monthKey: "1405-07", rows: [] },
        { monthKey: "1405-08", rows: [] },
        { monthKey: "1405-09", rows: [] },
      ] as never,
    });
    expect(sections).toEqual([]);
  });
});

// --- list view model ----------------------------------------------------------

describe("template list view model (ticket 05)", () => {
  it("marks the paused template with its badge and offers resume", () => {
    const vm = buildTemplateListViewModel({
      templates: [
        template(1, { title: "قسط وام", active: true }),
        template(2, { title: "نت", active: false }),
      ] as never,
      generatedThisMonth: {},
    });
    expect(vm.rows[0]).toMatchObject({ stateBadge: null });
    expect(pauseLabelFor(vm.rows[0]!)).toBe("توقف");
    expect(vm.rows[1]).toMatchObject({ stateBadge: "متوقف" });
    expect(pauseLabelFor(vm.rows[1]!)).toBe("ازسرگیری");
  });

  it("reads the rhythm in Persian voice with a clamped-day note", () => {
    const vm = buildTemplateListViewModel({
      templates: [template(1, { amountToman: 1500000, dayOfMonth: 31 })] as never,
      generatedThisMonth: {},
    });
    const label = rhythmLabelFor(vm.rows[0]!);
    expect(label).toContain("هر ماه");
    expect(label).toContain("۳۱");
    expect(label).toContain("۱٬۵۰۰٬۰۰۰");
  });

  it("shows the end date only while the template has one", () => {
    const withEnd = buildTemplateListViewModel({
      templates: [template(1, { endDate: "2026-12-29" })] as never,
      generatedThisMonth: {},
    });
    expect(rhythmLabelFor(withEnd.rows[0]!)).toContain("تا");
    const open = buildTemplateListViewModel({
      templates: [template(2, { endDate: null })] as never,
      generatedThisMonth: {},
    });
    expect(rhythmLabelFor(open.rows[0]!)).not.toContain("تا");
  });

  it("jumps to this month's generated expense only while one exists", () => {
    const vm = buildTemplateListViewModel({
      templates: [template(1), template(2)] as never,
      generatedThisMonth: { [v7(1)]: v7(91) },
    });
    expect(vm.rows[0]).toMatchObject({ generatedExpenseId: v7(91) });
    expect(vm.rows[1]).toMatchObject({ generatedExpenseId: null });
  });

  it("builds the generated map from the month's expenses, skipping manual rows", () => {
    const map = buildGeneratedThisMonth([
      { id: v7(91), sourceRecurringId: v7(1) },
      { id: v7(92), sourceRecurringId: null },
    ] as never);
    expect(map).toEqual({ [v7(1)]: v7(91) });
  });

  it("speaks one Persian voice for failures", () => {
    expect(TEMPLATE_MESSAGES.saveFailed).toContain("انجام نشد");
  });
});

// --- sheet validation + payloads -----------------------------------------------

describe("template sheet form (ticket 05)", () => {
  it("parses the day 1..31 and rejects the rest without touching the wire", () => {
    expect(parseTemplateDay("5")).toBe(5);
    expect(parseTemplateDay("31")).toBe(31);
    expect(parseTemplateDay("0")).toBeNull();
    expect(parseTemplateDay("32")).toBeNull();
    expect(parseTemplateDay("پنج")).toBeNull();
    expect(parseTemplateDay("")).toBeNull();
  });

  it("parses whole-Toman amounts with Persian digits and separators", () => {
    expect(parseTemplateAmount("1500000")).toBe(1500000);
    expect(parseTemplateAmount("۱٬۵۰۰٬۰۰۰")).toBe(1500000);
    expect(parseTemplateAmount("")).toBeNull();
    expect(parseTemplateAmount("0")).toBeNull();
  });

  function form(
    overrides: Record<string, unknown> = {},
  ): Parameters<typeof validateTemplateForm>[0] {
    return {
      title: "قسط وام",
      amountRaw: "200000",
      dayRaw: "5",
      categoryId: v7(1),
      startDate: "2026-08-01",
      endDate: null,
      ...overrides,
    };
  }

  it("saves a complete form", () => {
    expect(validateTemplateForm(form()).canSave).toBe(true);
  });

  it("refuses a blank title, a bad amount, a bad day, and a missing category", () => {
    expect(validateTemplateForm(form({ title: "   " })).canSave).toBe(false);
    expect(validateTemplateForm(form({ amountRaw: "" })).canSave).toBe(false);
    expect(validateTemplateForm(form({ dayRaw: "32" })).canSave).toBe(false);
    expect(validateTemplateForm(form({ categoryId: "" })).canSave).toBe(false);
  });

  it("refuses an end date before the start date (the window validates on the final pair)", () => {
    const checked = validateTemplateForm(
      form({ startDate: "2026-09-01", endDate: "2026-08-01" }),
    );
    expect(checked.windowValid).toBe(false);
    expect(checked.canSave).toBe(false);
  });

  it("accepts an open-ended window and a real end date", () => {
    expect(validateTemplateForm(form()).windowValid).toBe(true);
    expect(
      validateTemplateForm(form({ startDate: "2026-08-01", endDate: "2026-12-29" }))
        .windowValid,
    ).toBe(true);
  });

  it("refuses a non-calendar start date", () => {
    expect(validateTemplateForm(form({ startDate: "2026-13-40" })).canSave).toBe(
      false,
    );
  });

  it("builds a trimmed create payload, or null while the form cannot save", () => {
    expect(buildCreateTemplatePayload(form({ title: "  قسط وام " }))).toMatchObject({
      title: "قسط وام",
      amountToman: 200000,
      dayOfMonth: 5,
      categoryId: v7(1),
      startDate: "2026-08-01",
      endDate: null,
    });
    expect(buildCreateTemplatePayload(form({ title: "  " }))).toBeNull();
  });

  it("builds a full update payload like the web sheet (the server validates the final pair)", () => {
    expect(
      buildUpdateTemplatePayload(form({ amountRaw: "250000", dayRaw: "10" })),
    ).toMatchObject({
      title: "قسط وام",
      amountToman: 250000,
      dayOfMonth: 10,
      categoryId: v7(1),
      startDate: "2026-08-01",
      endDate: null,
    });
  });
});

// --- persistence over the typed client ------------------------------------------

describe("template persistence (ticket 05)", () => {
  it("creates over the wire with the trimmed payload", async () => {
    const { calls, fetchFn } = mockFetch((url) => {
      expect(url).toBe("/api/v1/recurring-templates");
      return jsonResponse(template(9, { title: "قسط وام" }));
    });
    const client = createV1Client({ fetchFn });
    const created = (await createTemplate(client as never, {
      title: "  قسط وام ",
      amountRaw: "200000",
      dayRaw: "5",
      categoryId: v7(1),
      startDate: "2026-08-01",
      endDate: null,
    })) as { title: string };
    expect(created.title).toBe("قسط وام");
    expect(JSON.parse(String(calls[0]!.init.body))).toMatchObject({
      title: "قسط وام",
      amountToman: 200000,
      dayOfMonth: 5,
    });
  });

  it("pauses and resumes through one active PATCH", async () => {
    const patched: Array<{ url: string; body: unknown }> = [];
    const { fetchFn } = mockFetch((url, init) => {
      patched.push({ url, body: JSON.parse(String(init.body)) });
      return jsonResponse(template(1, { active: false }));
    });
    const client = createV1Client({ fetchFn });
    const updated = (await toggleTemplateActive(
      client as never,
      template(1, { active: true }) as never,
    )) as { active: boolean };
    expect(updated.active).toBe(false);
    expect(patched).toHaveLength(1);
    expect(patched[0]).toMatchObject({
      url: `/api/v1/recurring-templates/${v7(1)}`,
      body: { active: false },
    });
  });

  it("saves an edit over the wire with the full payload", async () => {
    const { calls, fetchFn } = mockFetch((url) => {
      expect(url).toBe(`/api/v1/recurring-templates/${v7(1)}`);
      return jsonResponse(template(1, { amountToman: 250000 }));
    });
    const client = createV1Client({ fetchFn });
    await saveTemplateUpdate(client as never, v7(1), {
      title: "قسط وام",
      amountRaw: "250000",
      dayRaw: "5",
      categoryId: v7(1),
      startDate: "2026-08-01",
      endDate: null,
    });
    expect(JSON.parse(String(calls[0]!.init.body))).toMatchObject({
      amountToman: 250000,
      title: "قسط وام",
    });
  });

  it("throws before the wire while the form cannot save", async () => {
    const { calls, fetchFn } = mockFetch(() => jsonResponse(template(1)));
    const client = createV1Client({ fetchFn });
    await expect(
      createTemplate(client as never, {
        title: "   ",
        amountRaw: "200000",
        dayRaw: "5",
        categoryId: v7(1),
        startDate: "2026-08-01",
        endDate: null,
      }),
    ).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });
});

// --- loaders + invalidation --------------------------------------------------------

describe("template loaders (ticket 05)", () => {
  function wire() {
    return mockFetch((url) => {
      if (url === "/api/v1/recurring-templates")
        return jsonResponse([template(1)]);
      if (url === "/api/v1/categories") return jsonResponse([]);
      if (url === "/api/v1/events") return jsonResponse([]);
      if (url.startsWith("/api/v1/expenses"))
        return jsonResponse([
          {
            id: v7(91),
            amountToman: 200000,
            quantity: 1,
            unit: "piece",
            title: "قسط وام",
            note: null,
            categoryId: v7(1),
            occurredAt: "2026-08-25",
            monthKey: "1405-06",
            sourceRecurringId: v7(1),
            eventId: null,
            userId: "user-1",
            createdAt: "2026-08-25T00:00:00.000Z",
            updatedAt: "2026-08-25T00:00:00.000Z",
            category: {
              id: v7(1),
              name: "قسط",
              icon: null,
              color: null,
              kind: "custom",
              order: 1,
              slug: null,
              userId: "user-1",
              createdAt: "2026-08-01T00:00:00.000Z",
              updatedAt: "2026-08-01T00:00:00.000Z",
            },
          },
        ]);
      if (url.startsWith("/api/v1/recurring-templates/preview"))
        return jsonResponse(
          url.includes("month=1405-07")
            ? [
                {
                  templateId: v7(1),
                  title: "قسط وام",
                  amountToman: 200000,
                  categoryId: v7(1),
                  day: 5,
                },
              ]
            : [],
        );
      throw new Error(`unexpected ${url}`);
    });
  }

  it("loads the templates screen (list, categories, this month's ledger, three previews)", async () => {
    const { fetchFn } = wire();
    const client = createV1Client({ fetchFn });
    const screen = await loadTemplatesScreen(client as never, "1405-06");
    expect(screen.templates).toHaveLength(1);
    expect(screen.expenses).toHaveLength(1);
    expect(screen.events).toEqual([]);
    expect(screen.previews).toHaveLength(3);
    expect(screen.previews[0]).toMatchObject({ monthKey: "1405-07" });
    expect(screen.previews[0]!.rows).toHaveLength(1);
    expect(templatesKey()).toEqual(["templates"]);
  });

  it("refreshes dashboards and category counts without restart after a template mutation", async () => {
    const scopes = affectedScopesForTemplateMutation();
    expect(scopes.lists).toEqual(
      expect.arrayContaining(["templates", "dashboard", "categories"]),
    );
    const invalidateQueries = vi.fn(async () => {});
    await invalidateTemplateScopes({ invalidateQueries } as never, scopes);
    expect(invalidateQueries.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
