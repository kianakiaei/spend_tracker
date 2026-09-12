import { describe, expect, it } from "vitest";
import { z } from "zod";

// Ticket 01 (expo-mobile): the shared pure package is the single source of
// truth for the frozen v1 wire contract. This file pins wire parity at the
// highest seam — what the wire carries — plus the pure helpers mobile needs:
// Jalali month derivation/shifting, Persian normalization, quantity/unit
// arithmetic. Every assertion here must hold identically for the web
// re-exports in src/lib/* (zero wire change).

import {
  ApiError,
  createV1Client,
} from "@spend-tracker/shared/api/client";
import {
  fromISODate,
  jalaliMonthKey,
  shiftJalaliMonthKey,
} from "@spend-tracker/shared/jalali";
import { canonical } from "@spend-tracker/shared/normalize";
import {
  averageUnitPrice,
  totalQuantity,
  unitPrice,
} from "@spend-tracker/shared/quantity";
import { formatNumber, formatPercent } from "@spend-tracker/shared/format";
import {
  classifyResponseSchema as sharedClassifyResponse,
  monthSummaryResponseSchema as sharedSummary,
  categoryResponseSchema as sharedCategoryResponse,
  eventResponseSchema as sharedEventResponse,
  expenseResponseSchema as sharedExpenseResponse,
  forecastRowResponseSchema as sharedForecastRow,
  recurringTemplateResponseSchema as sharedTemplateResponse,
  searchResultResponseSchema as sharedSearchResult,
} from "@spend-tracker/shared/schemas";

// Web re-exports — the parity partners.
import {
  ApiError as WebApiError,
  createV1Client as createWebClient,
} from "@/lib/api/client";
import {
  fromISODate as webFromISODate,
  jalaliMonthKey as webMonthKey,
  shiftJalaliMonthKey as webShift,
} from "@/lib/jalali";
import { canonical as webCanonical } from "@/lib/categorization/normalize";
import {
  classifyResponseSchema as webClassifyResponse,
  monthSummaryResponseSchema as webSummary,
  categoryResponseSchema as webCategoryResponse,
  eventResponseSchema as webEventResponse,
  expenseResponseSchema as webExpenseResponse,
  forecastRowResponseSchema as webForecastRow,
  recurringTemplateResponseSchema as webTemplateResponse,
  searchResultResponseSchema as webSearchResult,
} from "@/lib/schemas";
import { formatNumber as webFormatNumber } from "@/lib/format";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("shared client wrapper (injected fetch, no network)", () => {
  const summary = { monthKey: "1404-10", totalToman: 1, byCategory: [] };

  it("sends a typed GET with its query and validates the success body", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const client = createV1Client({
      fetchFn: (async (input: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(input), init: init! });
        return jsonResponse(summary);
      }) as typeof fetch,
    });
    await expect(client.summaries.getByMonth("1404-10")).resolves.toEqual(
      summary,
    );
    expect(calls[0]!.url).toBe("/api/v1/summaries?month=1404-10");
    expect(calls[0]!.init.method).toBe("GET");
  });

  it("sends a typed POST body and honors an async Bearer header supplier", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const answer = {
      categoryId: "0198c0de-0000-7000-8000-000000000000",
      source: "fallback",
      matchedKey: null,
      confidence: null,
    };
    const client = createV1Client({
      baseUrl: "https://api.example.test/api/v1",
      headers: async () => ({ authorization: "Bearer token-1" }),
      fetchFn: (async (input: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(input), init: init! });
        return jsonResponse(answer);
      }) as typeof fetch,
    });
    await expect(client.classify({ title: "نان" })).resolves.toEqual(answer);
    expect(calls[0]!.url).toBe("https://api.example.test/api/v1/classify");
    expect(calls[0]!.init.headers).toMatchObject({
      authorization: "Bearer token-1",
      "content-type": "application/json",
    });
    expect(calls[0]!.init.body).toBe(JSON.stringify({ title: "نان" }));
  });

  it("returns void on 204 without parsing a body", async () => {
    const client = createV1Client({
      fetchFn: (async () => new Response(null, { status: 204 })) as typeof fetch,
    });
    await expect(client.expenses.remove("id-1")).resolves.toBeUndefined();
  });

  it("raises one error shape (ApiError) for problem+json failures", async () => {
    const client = createV1Client({
      fetchFn: (async () =>
        new Response(
          JSON.stringify({
            type: "/problems/validation_failed",
            title: "Validation failed",
            status: 400,
            errors: [{ path: "title", code: "too_small", message: "short" }],
          }),
          { status: 400 },
        )) as typeof fetch,
    });
    const error = await client.categories.list().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(400);
    expect((error as ApiError).errors).toEqual([
      { path: "title", code: "too_small", message: "short" },
    ]);
  });

  it("wraps non-problem error pages so callers still see ApiError", async () => {
    const client = createV1Client({
      fetchFn: (async () =>
        new Response("<html>crash</html>", { status: 502 })) as typeof fetch,
    });
    const error = await client.categories.list().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).problem.type).toBe("/problems/unknown");
  });

  it("re-raises ZodError when a success body violates the shared schema", async () => {
    const client = createV1Client({
      fetchFn: (async () =>
        jsonResponse({ id: "not-a-uuid" })) as typeof fetch,
    });
    await expect(client.categories.list()).rejects.toThrow(z.ZodError);
  });

  it("is the same contract class the web path throws", () => {
    expect(WebApiError).toBe(ApiError);
    expect(createWebClient).toBe(createV1Client);
  });
});

describe("shared Jalali month derivation and shifting", () => {
  it("derives the same month keys as the web module", () => {
    expect(jalaliMonthKey(fromISODate("2026-09-06"))).toBe("1405-06");
    expect(jalaliMonthKey(fromISODate("2026-03-20"))).toBe("1404-12");
    expect(jalaliMonthKey(fromISODate("2026-03-21"))).toBe("1405-01");
    expect(jalaliMonthKey(webFromISODate("2026-09-06"))).toBe(
      webMonthKey(webFromISODate("2026-09-06")),
    );
  });

  it("shifts month keys across year boundaries like the web module", () => {
    expect(shiftJalaliMonthKey("1405-12", 1)).toBe("1406-01");
    expect(shiftJalaliMonthKey("1405-01", -1)).toBe("1404-12");
    expect(shiftJalaliMonthKey("1405-06", 3)).toBe(webShift("1405-06", 3));
  });

  it("is the same function object the web module exports (move, not copy)", () => {
    expect(jalaliMonthKey).toBe(webMonthKey);
    expect(fromISODate).toBe(webFromISODate);
    expect(shiftJalaliMonthKey).toBe(webShift);
    expect(canonical).toBe(webCanonical);
    expect(formatNumber).toBe(webFormatNumber);
  });
});

describe("shared Persian normalization parity", () => {
  it("canonicalizes exactly like the categorization engine", () => {
    // ي/ي, digits, half-spaces — the same normalization search relies on.
    expect(canonical("شیر")).toBe(webCanonical("شير"));
    expect(canonical("۱۲۳")).toBe("123");
    expect(canonical("سبوس‌دار")).toBe(webCanonical("سبوس دار"));
    expect(canonical("  نان   سنگک  ")).toBe("نان سنگک");
  });
});

describe("shared quantity/unit arithmetic (insights semantics)", () => {
  it("prices one unit as Math.round(amount / quantity) with ?? 1", () => {
    expect(unitPrice(270_000, 0.5)).toBe(540_000);
    expect(unitPrice(100_000, undefined)).toBe(100_000);
    expect(unitPrice(100_000, null)).toBe(100_000);
  });

  it("averages weighted as Math.round(totalToman / totalQuantity), 0 when empty", () => {
    expect(averageUnitPrice(370_000, 2.5)).toBe(Math.round(370_000 / 2.5));
    expect(averageUnitPrice(0, 0)).toBe(0);
  });

  it("totals quantities with the same ?? 1 default as the services", () => {
    expect(totalQuantity([1, 0.5, undefined, null])).toBe(3.5);
    expect(totalQuantity([])).toBe(0);
  });
});

describe("shared fa-IR formatting (mobile display layer)", () => {
  it("groups tomans in Persian digits", () => {
    expect(formatNumber(1240000)).toBe("۱٬۲۴۰٬۰۰۰");
  });

  it("renders a share as a Persian percent", () => {
    expect(formatPercent(0.34)).toBe("۳۴٪");
  });
});

describe("shared schemas are the frozen wire shapes", () => {
  it("validates the same summary and classify bodies as the web schemas", () => {
    const summaryBody = { monthKey: "1404-10", totalToman: 1, byCategory: [] };
    expect(sharedSummary.safeParse(summaryBody).success).toBe(true);
    expect(webSummary.safeParse(summaryBody).success).toBe(true);
    const classifyBody = {
      categoryId: "0198c0de-0000-7000-8000-000000000000",
      source: "fallback",
      matchedKey: null,
      confidence: null,
    };
    expect(sharedClassifyResponse.safeParse(classifyBody).success).toBe(true);
    expect(webClassifyResponse.safeParse(classifyBody).success).toBe(true);
    // Not the same object identity until web re-exports shared — but once
    // ticket 01 lands, these ARE the same schema objects (zero wire change).
    expect(sharedSummary).toBe(webSummary);
    expect(sharedClassifyResponse).toBe(webClassifyResponse);
  });

  it("shares every other frozen response shape by identity with the web", () => {
    expect(sharedExpenseResponse).toBe(webExpenseResponse);
    expect(sharedCategoryResponse).toBe(webCategoryResponse);
    expect(sharedTemplateResponse).toBe(webTemplateResponse);
    expect(sharedForecastRow).toBe(webForecastRow);
    expect(sharedSearchResult).toBe(webSearchResult);
    expect(sharedEventResponse).toBe(webEventResponse);
  });
});

describe("shared client — every resource method hits its frozen path", () => {
  const CATEGORY_ID = "0198c0de-0000-7000-8000-000000000001";
  const EXPENSE_ID = "0198c0de-0000-7000-8000-000000000002";
  const TEMPLATE_ID = "0198c0de-0000-7000-8000-000000000003";
  const EVENT_ID = "0198c0de-0000-7000-8000-000000000004";
  const STAMP = "2026-09-06T00:00:00.000Z";

  const category = {
    id: CATEGORY_ID,
    name: "خوراکی",
    icon: null,
    color: null,
    kind: "custom",
    order: 6,
    slug: null,
    userId: "user-1",
    createdAt: STAMP,
    updatedAt: STAMP,
  };
  const expense = {
    id: EXPENSE_ID,
    amountToman: 270_000,
    quantity: 0.5,
    unit: "kg",
    title: "بستنی",
    note: null,
    categoryId: CATEGORY_ID,
    occurredAt: "2026-09-06",
    monthKey: "1405-06",
    sourceRecurringId: null,
    eventId: null,
    userId: "user-1",
    createdAt: STAMP,
    updatedAt: STAMP,
    category,
  };
  const template = {
    id: TEMPLATE_ID,
    title: "قسط",
    amountToman: 1_000_000,
    categoryId: CATEGORY_ID,
    dayOfMonth: 5,
    startDate: "2026-09-06",
    endDate: null,
    active: true,
    userId: "user-1",
    createdAt: STAMP,
    updatedAt: STAMP,
  };
  const forecastRow = {
    templateId: TEMPLATE_ID,
    title: "قسط",
    amountToman: 1_000_000,
    categoryId: CATEGORY_ID,
    day: 5,
  };
  const event = {
    id: EVENT_ID,
    title: "سفر",
    note: null,
    startDate: null,
    endDate: null,
    userId: "user-1",
    createdAt: STAMP,
    updatedAt: STAMP,
  };
  const searchHit = {
    expenseId: EXPENSE_ID,
    title: "بستنی",
    amountToman: 270_000,
    quantity: 0.5,
    unit: "kg",
    monthKey: "1405-06",
    occurredAt: "2026-09-06",
    categoryName: "خوراکی",
    categoryId: CATEGORY_ID,
    eventTitle: null,
    eventId: null,
    sourceRecurringId: null,
  };

  function sweepClient() {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const bodies = new Map<string, unknown>([
      ["GET /api/v1/expenses?month=1405-06", [expense]],
      ["POST /api/v1/expenses", expense],
      [`GET /api/v1/expenses/${EXPENSE_ID}`, expense],
      [`PATCH /api/v1/expenses/${EXPENSE_ID}`, expense],
      ["GET /api/v1/categories", [category]],
      ["POST /api/v1/categories", category],
      [`PATCH /api/v1/categories/${CATEGORY_ID}`, category],
      [
        `POST /api/v1/categories/${CATEGORY_ID}/move-expenses`,
        { moved: 2 },
      ],
      ["GET /api/v1/recurring-templates", [template]],
      ["POST /api/v1/recurring-templates", template],
      [`PATCH /api/v1/recurring-templates/${TEMPLATE_ID}`, template],
      ["GET /api/v1/recurring-templates/preview?month=1405-07", [forecastRow]],
      ["GET /api/v1/events", [event]],
      ["POST /api/v1/events", event],
      [`GET /api/v1/events/${EVENT_ID}`, event],
      [`PATCH /api/v1/events/${EVENT_ID}`, event],
      ["GET /api/v1/search?q=%D8%A8%D8%B3%D8%AA%D9%86%DB%8C", [searchHit]],
    ]);
    const client = createV1Client({
      fetchFn: (async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input).replace(/^https?:\/\/[^/]+/, "");
        const method = init?.method ?? "GET";
        calls.push({ url, init: init! });
        if (method === "DELETE") return new Response(null, { status: 204 });
        const body = bodies.get(`${method} ${url}`);
        if (body === undefined)
          throw new Error(`unexpected call ${method} ${url}`);
        return jsonResponse(body);
      }) as typeof fetch,
    });
    return { client, calls };
  }

  it("round-trips expenses with quantity/unit intact", async () => {
    const { client, calls } = sweepClient();
    await expect(client.expenses.listByMonth("1405-06")).resolves.toEqual([
      expense,
    ]);
    await expect(
      client.expenses.create({
        amountToman: 270_000,
        quantity: 0.5,
        unit: "kg",
        title: "بستنی",
        categoryId: CATEGORY_ID,
        occurredAt: "2026-09-06",
      }),
    ).resolves.toEqual(expense);
    await expect(client.expenses.get(EXPENSE_ID)).resolves.toEqual(expense);
    await expect(
      client.expenses.update(EXPENSE_ID, { title: "بستنی" }),
    ).resolves.toEqual(expense);
    await expect(
      client.expenses.remove(EXPENSE_ID),
    ).resolves.toBeUndefined();
    expect(calls.map((c) => `${c.init.method} ${c.url}`)).toEqual([
      "GET /api/v1/expenses?month=1405-06",
      `POST /api/v1/expenses`,
      `GET /api/v1/expenses/${EXPENSE_ID}`,
      `PATCH /api/v1/expenses/${EXPENSE_ID}`,
      `DELETE /api/v1/expenses/${EXPENSE_ID}`,
    ]);
  });

  it("round-trips categories including move-expenses", async () => {
    const { client } = sweepClient();
    await expect(client.categories.list()).resolves.toEqual([category]);
    await expect(
      client.categories.create({ name: "خوراکی" }),
    ).resolves.toEqual(category);
    await expect(
      client.categories.update(CATEGORY_ID, { name: "خوراکی" }),
    ).resolves.toEqual(category);
    await expect(
      client.categories.moveExpenses(CATEGORY_ID, {
        targetCategoryId: CATEGORY_ID,
      }),
    ).resolves.toEqual({ moved: 2 });
    await expect(
      client.categories.remove(CATEGORY_ID),
    ).resolves.toBeUndefined();
  });

  it("round-trips templates including the forecast preview", async () => {
    const { client } = sweepClient();
    await expect(client.recurringTemplates.list()).resolves.toEqual([
      template,
    ]);
    await expect(
      client.recurringTemplates.create({
        amountToman: 1_000_000,
        title: "قسط",
        categoryId: CATEGORY_ID,
        dayOfMonth: 5,
        startDate: "2026-09-06",
      }),
    ).resolves.toEqual(template);
    await expect(
      client.recurringTemplates.update(TEMPLATE_ID, { active: false }),
    ).resolves.toEqual(template);
    await expect(
      client.recurringTemplates.preview("1405-07"),
    ).resolves.toEqual([forecastRow]);
    await expect(
      client.recurringTemplates.remove(TEMPLATE_ID),
    ).resolves.toBeUndefined();
  });

  it("round-trips events, search, and the default same-origin base URL", async () => {
    const { client, calls } = sweepClient();
    await expect(client.events.list()).resolves.toEqual([event]);
    await expect(client.events.create({ title: "سفر" })).resolves.toEqual(
      event,
    );
    await expect(client.events.get(EVENT_ID)).resolves.toEqual(event);
    await expect(
      client.events.update(EVENT_ID, { title: "سفر" }),
    ).resolves.toEqual(event);
    await expect(client.events.remove(EVENT_ID)).resolves.toBeUndefined();
    await expect(client.search.byTitle("بستنی")).resolves.toEqual([
      searchHit,
    ]);
    expect(calls[0]!.url.startsWith("/api/v1/")).toBe(true);
  });
});
