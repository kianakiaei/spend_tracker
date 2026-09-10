import { afterAll, describe, expect, it } from "vitest";
import { newId } from "@/lib/id";
import { createCategoryService } from "@/lib/services/category-service";
import { createExpenseService } from "@/lib/services/expense-service";
import { createEventService } from "@/lib/services/event-service";
import { NotFoundError, ValidationError } from "@/lib/services/errors";
import { setupIntegrationDb } from "../helpers/integration";

// Event service on a real temp libSQL file: named buckets (رویداد, e.g.
// travel). An expense joins an event by manual attach while keeping its
// category AND its month — the event is a pure overlay. Deleting an event
// only unlinks, never deletes.

const fx = await setupIntegrationDb("event-service");
const categories = createCategoryService(fx.db);
const expensesService = createExpenseService(fx.db);
const eventService = createEventService(fx.db);

afterAll(async () => {
  await fx.close();
});

async function systemCategory(userId: string, slug: string): Promise<string> {
  const category = (await categories.list(userId)).find((c) => c.slug === slug);
  if (!category) throw new Error(`system category ${slug} missing`);
  return category.id;
}
describe("eventService CRUD", () => {
  it("creates, lists and gets an event owned by the user", async () => {
    const userId = await fx.signUp();
    const created = await eventService.create(userId, {
      title: "سفر اصفهان",
      note: "سه روزه",
    });
    expect(created.title).toBe("سفر اصفهان");

    const listed = await eventService.list(userId);
    expect(listed.map((e) => e.id)).toContain(created.id);

    const got = await eventService.get(userId, created.id);
    expect(got.title).toBe("سفر اصفهان");
  });

  it("is scoped to the user", async () => {
    const userId = await fx.signUp();
    const other = await fx.signUp();
    const event = await eventService.create(other, { title: "عروسی" });

    expect(await eventService.list(userId)).toHaveLength(0);
    await expect(eventService.get(userId, event.id)).rejects.toThrow(
      NotFoundError,
    );
  });

  it("enforces unique titles per user", async () => {
    const userId = await fx.signUp();
    await eventService.create(userId, { title: "سفر مشهد" });
    await expect(
      eventService.create(userId, { title: "سفر مشهد" }),
    ).rejects.toThrow();
    const other = await fx.signUp();
    await expect(
      eventService.create(other, { title: "سفر مشهد" }),
    ).resolves.toBeTruthy();
  });

  it("renames an event freely", async () => {
    const userId = await fx.signUp();
    const event = await eventService.create(userId, { title: "سفر قم" });
    const updated = await eventService.update(userId, event.id, {
      title: "سفر قم و کاشان",
    });
    expect(updated.title).toBe("سفر قم و کاشان");
  });

  it("rejects an inverted date range on create and update", async () => {
    const userId = await fx.signUp();
    await expect(
      eventService.create(userId, {
        title: "بد",
        startDate: "2026-09-06",
        endDate: "2026-09-01",
      }),
    ).rejects.toThrow(ValidationError);

    const event = await eventService.create(userId, {
      title: "سفر",
      startDate: "2026-09-06",
    });
    await expect(
      eventService.update(userId, event.id, { endDate: "2026-09-01" }),
    ).rejects.toThrow(ValidationError);
  });

  it("deleting an event unlinks its expenses but never deletes them", async () => {
    const userId = await fx.signUp();
    const groceries = await systemCategory(userId, "groceries");
    const event = await eventService.create(userId, { title: "سفر شمال" });

    const e1 = await expensesService.create(
      userId,
      { amountToman: 10_000, title: "نان", categoryId: groceries, eventId: event.id },
      "1405-06",
    );
    const e2 = await expensesService.create(
      userId,
      { amountToman: 5_000, title: "شیر", categoryId: groceries },
      "1405-06",
    );

    await eventService.remove(userId, event.id);
    const rows = await expensesService.listByMonth(userId, "1405-06");
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.id === e1.id)?.eventId).toBeNull();
    expect(rows.find((r) => r.id === e2.id)?.eventId).toBeNull();
  });
});
describe("expense event membership", () => {
  it("an expense attached to an event keeps its category and month", async () => {
    const userId = await fx.signUp();
    const groceries = await systemCategory(userId, "groceries");
    const event = await eventService.create(userId, { title: "سفر تبریز" });

    const expense = await expensesService.create(
      userId,
      {
        amountToman: 20_000,
        title: "لاستی",
        categoryId: groceries,
        occurredAt: "2026-09-06",
        eventId: event.id,
      },
      "1405-05",
    );

    expect(expense.eventId).toBe(event.id);
    // the month still comes from the date — the event never affects it
    expect(expense.monthKey).toBe("1405-06");
  });

  it("rejects an event that does not exist or belong to the user", async () => {
    const userId = await fx.signUp();
    const groceries = await systemCategory(userId, "groceries");
    await expect(
      expensesService.create(
        userId,
        { amountToman: 1, title: "x", categoryId: groceries, eventId: newId() },
        "1405-06",
      ),
    ).rejects.toThrow(NotFoundError);

    const other = await fx.signUp();
    const foreign = await eventService.create(other, { title: "خارجی" });
    await expect(
      expensesService.create(
        userId,
        { amountToman: 1, title: "x", categoryId: groceries, eventId: foreign.id },
        "1405-06",
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it("update can attach, move and clear an event", async () => {
    const userId = await fx.signUp();
    const groceries = await systemCategory(userId, "groceries");
    const a = await eventService.create(userId, { title: "سفر الف" });
    const b = await eventService.create(userId, { title: "سفر ب" });

    const expense = await expensesService.create(
      userId,
      { amountToman: 5_000, title: "شیر", categoryId: groceries, eventId: a.id },
      "1405-06",
    );

    const moved = await expensesService.update(userId, expense.id, { eventId: b.id });
    expect(moved.eventId).toBe(b.id);

    const cleared = await expensesService.update(userId, expense.id, { eventId: null });
    expect(cleared.eventId).toBeNull();
  });
});

describe("event summary + expenses", () => {
  it("sums the event's recorded expenses and counts them", async () => {
    const userId = await fx.signUp();
    const groceries = await systemCategory(userId, "groceries");
    const transport = await systemCategory(userId, "transport");
    const event = await eventService.create(userId, { title: "سفر شیراز" });

    await expensesService.create(
      userId,
      { amountToman: 100_000, title: "بنزین", categoryId: transport, eventId: event.id },
      "1405-06",
    );
    await expensesService.create(
      userId,
      { amountToman: 50_000, title: "غذا", categoryId: groceries, eventId: event.id },
      "1405-06",
    );
    await expensesService.create(
      userId,
      { amountToman: 9_000, title: "نان", categoryId: groceries },
      "1405-06",
    );

    const summary = await eventService.summary(userId, event.id);
    expect(summary).toEqual({ totalToman: 150_000, count: 2 });

    const rows = await eventService.listExpenses(userId, event.id);
    expect(rows).toHaveLength(2);
  });

  it("listExpenses is newest first with undated last", async () => {
    const userId = await fx.signUp();
    const groceries = await systemCategory(userId, "groceries");
    const event = await eventService.create(userId, { title: "سفر یزد" });

    const old = await expensesService.create(
      userId,
      { amountToman: 1_000, title: "قدیم", categoryId: groceries, occurredAt: "2026-08-01", eventId: event.id },
      "1405-05",
    );
    const undated = await expensesService.create(
      userId,
      { amountToman: 2_000, title: "بی‌تاریخ", categoryId: groceries, eventId: event.id },
      "1405-06",
    );
    const recent = await expensesService.create(
      userId,
      { amountToman: 3_000, title: "جدید", categoryId: groceries, occurredAt: "2026-09-06", eventId: event.id },
      "1405-06",
    );

    const rows = await eventService.listExpenses(userId, event.id);
    expect(rows.map((r) => r.id)).toEqual([recent.id, old.id, undated.id]);
  });
});