import { describe, expect, it, vi } from "vitest";

// Expo-mobile ticket 06 (Events and detail): event buckets as a second layer
// over categorized monthly expenses — list with totals, create/rename,
// detail with locked-event entry, and unlink-only deletion. Like tickets
// 02-05, the mobile core is pure TypeScript with injected seams (V1Client
// over an injected fetch), tested here at the highest seam — what the wire
// carries and what the view model holds — never component internals. The
// Expo Router screens in apps/mobile are thin wrappers.
//
// Frozen-API note (spec: no new endpoints, no contract changes): the web
// events page reads the event service directly (all-time totals + full
// expense list). The frozen API exposes no event-summary or event-expenses
// read — only events list/get/update/delete plus the month-scoped ledger —
// so mobile shows this month's total + count per event (labelled as such,
// the ticket-04 precedent) and the detail carries an unbounded month
// navigator like the category drilldown. Unlink-only deletion stays server
// business (DELETE /events/[id] unlinks; rows keep category + month).

import {
  EVENT_MESSAGES,
  buildCreateEventPayload,
  buildEventDetail,
  buildEventListViewModel,
  buildRenameEventPayload,
  createEvent,
  removeEvent,
  renameEvent,
  validateEventTitle,
} from "../../apps/mobile/src/events";
import {
  affectedScopesForEventMutation,
  eventsKey,
  invalidateEventScopes,
  loadEventDetail,
  loadEventsScreen,
} from "../../apps/mobile/src/event-queries";
import { createV1Client } from "../../packages/shared/src/api/client";

// --- fixtures ---------------------------------------------------------------

function v7(n: number): string {
  return `01938f4a-7b1e-7a1e-8000-${String(n).padStart(12, "0")}`;
}

function event(
  id: number,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: v7(id),
    title: `رویداد ${id}`,
    note: null,
    startDate: null,
    endDate: null,
    userId: "user-1",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
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
    amountToman: 100000,
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

// --- list view model ----------------------------------------------------------

describe("event list view model (ticket 06)", () => {
  it("totals this month's ledger rows per event, keeping server order", () => {
    const vm = buildEventListViewModel({
      events: [event(1, { title: "سفر اصفهان" }), event(2, { title: "عروسی" })] as never,
      expenses: [
        expense(91, { eventId: v7(1), amountToman: 100000 }),
        expense(92, { eventId: v7(1), amountToman: 250000 }),
        expense(93, { eventId: v7(2), amountToman: 50000 }),
      ] as never,
    });
    expect(vm.rows).toHaveLength(2);
    expect(vm.rows[0]).toMatchObject({
      title: "سفر اصفهان",
      totalToman: 350000,
      count: 2,
    });
    expect(vm.rows[1]).toMatchObject({ totalToman: 50000, count: 1 });
  });

  it("ignores unattached rows and rows attached to other events", () => {
    const vm = buildEventListViewModel({
      events: [event(1)] as never,
      expenses: [
        expense(91, { eventId: null, amountToman: 999999 }),
        expense(92, { eventId: v7(9), amountToman: 888888 }),
        expense(93, { eventId: v7(1), amountToman: 100000 }),
      ] as never,
    });
    expect(vm.rows[0]).toMatchObject({ totalToman: 100000, count: 1 });
  });

  it("labels the overlay in Persian voice with Persian digits", () => {
    const vm = buildEventListViewModel({
      events: [event(1), event(2)] as never,
      expenses: [
        expense(91, { eventId: v7(1), amountToman: 1500000 }),
        expense(92, { eventId: v7(1), amountToman: 500000 }),
      ] as never,
    });
    expect(vm.rows[0]!.overlayLabel).toContain("۲ خرج در این ماه");
    expect(vm.rows[0]!.overlayLabel).toContain("تومان");
    // Latin digits never leak into the overlay.
    expect(vm.rows[0]!.overlayLabel).not.toMatch(/[0-9]/);
    expect(vm.rows[1]!.overlayLabel).toContain("بدون خرج در این ماه");
  });

  it("links each row to its stack detail (back keeps context)", () => {
    const vm = buildEventListViewModel({
      events: [event(1)] as never,
      expenses: [] as never,
    });
    expect(vm.rows[0]!.drilldown).toBe(`/event/${v7(1)}`);
  });

  it("speaks one Persian voice for failures and the unlink-only confirm", () => {
    expect(EVENT_MESSAGES.saveFailed).toContain("انجام نشد");
    expect(EVENT_MESSAGES.emptyList).toContain("رویداد");
    expect(EVENT_MESSAGES.deleteConfirm).toContain("خرج‌ها می‌مانند");
  });
});

// --- form validation + payloads -------------------------------------------------

describe("event form (ticket 06)", () => {
  it("refuses a blank title without touching the wire", () => {
    expect(validateEventTitle("   ")).toBe(false);
    expect(validateEventTitle("سفر")).toBe(true);
    expect(buildCreateEventPayload("   ", null)).toBeNull();
    expect(buildRenameEventPayload("  ")).toBeNull();
  });

  it("builds a trimmed create payload with a null note while blank", () => {
    expect(buildCreateEventPayload("  سفر اصفهان ", "  ")).toMatchObject({
      title: "سفر اصفهان",
      note: null,
    });
    expect(
      buildCreateEventPayload("سفر اصفهان", "سه روزه با خانواده"),
    ).toMatchObject({ title: "سفر اصفهان", note: "سه روزه با خانواده" });
  });

  it("builds a trimmed rename payload like the web manager", () => {
    expect(buildRenameEventPayload("  عروسی سارا ")).toMatchObject({
      title: "عروسی سارا",
    });
  });
});

// --- detail panel -----------------------------------------------------------------

describe("event detail (ticket 06)", () => {
  it("shows the event's panel: total, count, and only its own rows", () => {
    const panel = buildEventDetail({
      eventId: v7(1),
      events: [event(1, { title: "سفر اصفهان" }), event(2)] as never,
      expenses: [
        expense(91, {
          eventId: v7(1),
          categoryId: v7(3),
          amountToman: 100000,
          monthKey: "1405-06",
          occurredAt: "2026-08-25",
        }),
        expense(92, { eventId: v7(2), amountToman: 777777 }),
        expense(93, { eventId: null, amountToman: 666666 }),
      ] as never,
    });
    expect(panel.event.title).toBe("سفر اصفهان");
    expect(panel).toMatchObject({ totalToman: 100000, count: 1, isEmpty: false });
    expect(panel.expenses).toHaveLength(1);
    expect(panel.lockedEventId).toBe(v7(1));
  });

  it("keeps each row's own category and occurrence month (the event never replaces them)", () => {
    const panel = buildEventDetail({
      eventId: v7(1),
      events: [event(1)] as never,
      expenses: [
        expense(91, {
          eventId: v7(1),
          categoryId: v7(3),
          monthKey: "1405-06",
          occurredAt: "2026-08-25",
        }),
      ] as never,
    });
    expect(panel.expenses[0]).toMatchObject({
      categoryId: v7(3),
      monthKey: "1405-06",
      occurredAt: "2026-08-25",
    });
  });

  it("reports an empty event so the screen renders its empty state", () => {
    const panel = buildEventDetail({
      eventId: v7(1),
      events: [event(1)] as never,
      expenses: [] as never,
    });
    expect(panel).toMatchObject({ totalToman: 0, count: 0, isEmpty: true });
  });

  it("throws for an unknown event — never a stranger's panel", () => {
    expect(() =>
      buildEventDetail({
        eventId: v7(9),
        events: [event(1)] as never,
        expenses: [] as never,
      }),
    ).toThrow();
  });
});

// --- persistence over the typed client --------------------------------------------

describe("event persistence (ticket 06)", () => {
  it("creates over the wire with the trimmed payload", async () => {
    const { calls, fetchFn } = mockFetch((url) => {
      expect(url).toBe("/api/v1/events");
      return jsonResponse(event(9, { title: "سفر اصفهان" }));
    });
    const client = createV1Client({ fetchFn });
    const created = (await createEvent(client as never, {
      title: "  سفر اصفهان ",
      note: "سه روزه",
    })) as { title: string; note: string };
    expect(created.title).toBe("سفر اصفهان");
    expect(JSON.parse(String(calls[0]!.init.body))).toMatchObject({
      title: "سفر اصفهان",
      note: "سه روزه",
    });
  });

  it("renames over the wire with a title-only PATCH", async () => {
    const { calls, fetchFn } = mockFetch((url) => {
      expect(url).toBe(`/api/v1/events/${v7(1)}`);
      return jsonResponse(event(1, { title: "عروسی سارا" }));
    });
    const client = createV1Client({ fetchFn });
    await renameEvent(client as never, v7(1), "  عروسی سارا ");
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({
      title: "عروسی سارا",
    });
  });

  it("deletes through the event endpoint only — expenses are unlinked server-side, never deleted", async () => {
    const { calls, fetchFn } = mockFetch((url, init) => {
      expect(url).toBe(`/api/v1/events/${v7(1)}`);
      expect(init.method).toBe("DELETE");
      return new Response(null, { status: 204 });
    });
    const client = createV1Client({ fetchFn });
    await removeEvent(client as never, v7(1));
    expect(calls).toHaveLength(1);
    expect(calls.every((call) => call.url.startsWith("/api/v1/events"))).toBe(
      true,
    );
  });

  it("throws before the wire while the title is blank", async () => {
    const { calls, fetchFn } = mockFetch(() => jsonResponse(event(1)));
    const client = createV1Client({ fetchFn });
    await expect(
      createEvent(client as never, { title: "   ", note: null }),
    ).rejects.toThrow();
    await expect(renameEvent(client as never, v7(1), "  ")).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });
});

// --- loaders + invalidation ----------------------------------------------------------

describe("event loaders (ticket 06)", () => {
  function wire() {
    return mockFetch((url) => {
      if (url === "/api/v1/events") return jsonResponse([event(1)]);
      if (url === "/api/v1/categories") return jsonResponse([category(1)]);
      if (url.startsWith("/api/v1/expenses"))
        return jsonResponse([expense(91, { eventId: v7(1) })]);
      throw new Error(`unexpected ${url}`);
    });
  }

  it("loads the events list (events plus this month's ledger)", async () => {
    const { fetchFn } = wire();
    const client = createV1Client({ fetchFn });
    const screen = await loadEventsScreen(client as never, "1405-06");
    expect(screen.events).toHaveLength(1);
    expect(screen.expenses).toHaveLength(1);
    expect(eventsKey()).toEqual(["events"]);
  });

  it("loads one detail month (event list, this month's ledger, categories)", async () => {
    const { calls, fetchFn } = wire();
    const client = createV1Client({ fetchFn });
    const detail = await loadEventDetail(client as never, "1405-06");
    expect(detail.events).toHaveLength(1);
    expect(detail.expenses).toHaveLength(1);
    expect(
      calls.some((call) => call.url.includes("month=1405-06")),
    ).toBe(true);
  });

  it("refreshes the events surface plus dependent scopes without restart", async () => {
    const scopes = affectedScopesForEventMutation();
    expect(scopes.lists).toEqual(
      expect.arrayContaining(["events", "dashboard", "search"]),
    );
    const invalidateQueries = vi.fn(async () => {});
    await invalidateEventScopes({ invalidateQueries } as never, scopes);
    expect(invalidateQueries.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
