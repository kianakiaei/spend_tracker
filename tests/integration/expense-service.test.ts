import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { learnedKeys } from "@/db/schema";
import { newId } from "@/lib/id";
import { createCategoryService } from "@/lib/services/category-service";
import { createExpenseService } from "@/lib/services/expense-service";
import { NotFoundError, ValidationError } from "@/lib/services/errors";
import { jalaliMonthKey, fromISODate } from "@/lib/jalali";
import { setupIntegrationDb } from "../helpers/integration";

// Expense service rules on a real temp libSQL file (ticket 22): NO date
// constraints — past/future/undated all allowed (ticket 15) — but the
// monthKey contract is strict: dated → derived from occurredAt, undated →
// the explicit form month; a dated expense always lands in its own month.

const fx = await setupIntegrationDb("expense-service");
const categories = createCategoryService(fx.db);
const expensesService = createExpenseService(fx.db);

afterAll(async () => {
  await fx.close();
});

async function systemCategory(userId: string, slug: string): Promise<string> {
  const category = (await categories.list(userId)).find((c) => c.slug === slug);
  if (!category) throw new Error(`system category ${slug} missing`);
  return category.id;
}

const monthKeyOf = (iso: string) => jalaliMonthKey(fromISODate(iso));

describe("expenseService.create — the monthKey rule (ticket 22)", () => {
  it("derives monthKey from occurredAt when dated", async () => {
    const userId = await fx.signUp();
    const categoryId = await systemCategory(userId, "groceries");

    const expense = await expensesService.create(
      userId,
      { amountToman: 25_000, title: "نان بربری", categoryId, occurredAt: "2026-09-06" },
      "1404-12",
    );

    expect(expense.occurredAt).toBe("2026-09-06");
    expect(expense.monthKey).toBe(monthKeyOf("2026-09-06"));
    expect(expense.sourceRecurringId).toBeNull();
  });

  it("uses the form month for an undated expense (the explicit service parameter)", async () => {
    const userId = await fx.signUp();
    const categoryId = await systemCategory(userId, "installment");

    const expense = await expensesService.create(
      userId,
      { amountToman: 1_500_000, title: "قسط وام", categoryId, occurredAt: null },
      "1404-12",
    );

    expect(expense.occurredAt).toBeNull();
    expect(expense.monthKey).toBe("1404-12");
  });

  it("a dated expense always lands in its own month — even against the form month", async () => {
    const userId = await fx.signUp();
    const categoryId = await systemCategory(userId, "transport");

    const expense = await expensesService.create(
      userId,
      { amountToman: 80_000, title: "اسنپ", categoryId, occurredAt: "2026-10-01" },
      "1404-12",
    );

    expect(expense.monthKey).toBe(monthKeyOf("2026-10-01"));
    expect(expense.monthKey).not.toBe("1404-12");
  });

  it("accepts past and future dates alike (no date constraints — ticket 15)", async () => {
    const userId = await fx.signUp();
    const categoryId = await systemCategory(userId, "groceries");

    const past = await expensesService.create(
      userId,
      { amountToman: 1, title: "قدیمی", categoryId, occurredAt: "1996-01-01" },
      "1405-06",
    );
    const future = await expensesService.create(
      userId,
      { amountToman: 1, title: "آینده", categoryId, occurredAt: "2060-12-31" },
      "1405-06",
    );

    expect(past.monthKey).toBe(monthKeyOf("1996-01-01"));
    expect(future.monthKey).toBe(monthKeyOf("2060-12-31"));
  });

  it("rejects invalid inputs with typed validation errors", async () => {
    const userId = await fx.signUp();
    const categoryId = await systemCategory(userId, "groceries");
    const base = { amountToman: 1, title: "نان", categoryId };

    await expect(
      expensesService.create(userId, { ...base, amountToman: 0 }, "1405-06"),
    ).rejects.toThrow(ValidationError);
    await expect(
      expensesService.create(userId, { ...base, title: "   " }, "1405-06"),
    ).rejects.toThrow(ValidationError);
    await expect(
      expensesService.create(userId, { ...base, categoryId: "abc" }, "1405-06"),
    ).rejects.toThrow(ValidationError);
    await expect(
      expensesService.create(userId, { ...base, occurredAt: "2026-02-30" }, "1405-06"),
    ).rejects.toThrow(ValidationError);
    // format level: not a date-only 'YYYY-MM-DD' string
    await expect(
      expensesService.create(userId, { ...base, occurredAt: "2026/09/06" }, "1405-06"),
    ).rejects.toThrow(ValidationError);
    await expect(
      expensesService.create(userId, base, "140506"),
    ).rejects.toThrow(ValidationError);
    await expect(
      expensesService.create(userId, { ...base, categoryId: newId() }, "1405-06"),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("expenseService quantity + unit (kilo support)", () => {
  it("stores fractional kilos with unit 'kg'", async () => {
    const userId = await fx.signUp();
    const categoryId = await systemCategory(userId, "groceries");

    const expense = await expensesService.create(
      userId,
      { amountToman: 270_000, quantity: 0.5, unit: "kg", title: "بستنی", categoryId },
      "1405-06",
    );

    expect(expense.quantity).toBe(0.5);
    expect(expense.unit).toBe("kg");
    const fetched = await expensesService.get(userId, expense.id);
    expect(fetched.quantity).toBe(0.5);
    expect(fetched.unit).toBe("kg");
  });

  it("defaults to one piece when quantity and unit are omitted", async () => {
    const userId = await fx.signUp();
    const categoryId = await systemCategory(userId, "groceries");

    const expense = await expensesService.create(
      userId,
      { amountToman: 30_000, title: "نان", categoryId },
      "1405-06",
    );

    expect(expense.quantity).toBe(1);
    expect(expense.unit).toBe("piece");
  });

  it("rejects fractional pieces and bad units", async () => {
    const userId = await fx.signUp();
    const categoryId = await systemCategory(userId, "groceries");
    const base = { amountToman: 100_000, title: "سیب", categoryId };

    await expect(
      expensesService.create(userId, { ...base, quantity: 2.5 }, "1405-06"),
    ).rejects.toThrow(ValidationError);
    await expect(
      expensesService.create(
        userId,
        { ...base, quantity: 2.5, unit: "piece" },
        "1405-06",
      ),
    ).rejects.toThrow(ValidationError);
    await expect(
      expensesService.create(
        userId,
        { ...base, quantity: 0.12345, unit: "kg" },
        "1405-06",
      ),
    ).rejects.toThrow(ValidationError);
    await expect(
      expensesService.create(
        userId,
        { ...base, quantity: 1, unit: "kilo" as never },
        "1405-06",
      ),
    ).rejects.toThrow(ValidationError);
  });

  it("a unit-only edit cannot turn fractional kilos into fractional pieces", async () => {
    const userId = await fx.signUp();
    const categoryId = await systemCategory(userId, "groceries");
    const expense = await expensesService.create(
      userId,
      { amountToman: 132_000, quantity: 2.5, unit: "kg", title: "آلو", categoryId },
      "1405-06",
    );

    await expect(
      expensesService.update(userId, expense.id, { unit: "piece" }),
    ).rejects.toThrow(ValidationError);
    const kept = await expensesService.update(userId, expense.id, {
      quantity: 3,
      unit: "kg",
      note: null,
    });
    expect(kept.quantity).toBe(3);
    expect(kept.unit).toBe("kg");
  });
});

describe("expenseService.update — monthKey moves (ticket 22)", () => {
  it("giving a date to an undated expense moves it to that date's month", async () => {
    const userId = await fx.signUp();
    const categoryId = await systemCategory(userId, "bills-internet");
    const expense = await expensesService.create(
      userId,
      { amountToman: 300_000, title: "قبض برق", categoryId, occurredAt: null },
      "1404-12",
    );

    const updated = await expensesService.update(userId, expense.id, {
      occurredAt: "2026-01-10",
    });

    expect(updated.occurredAt).toBe("2026-01-10");
    expect(updated.monthKey).toBe(monthKeyOf("2026-01-10"));
  });

  it("clearing the date keeps the expense in the month it currently belongs to", async () => {
    const userId = await fx.signUp();
    const categoryId = await systemCategory(userId, "cafe-restaurant");
    const expense = await expensesService.create(
      userId,
      { amountToman: 90_000, title: "کافه", categoryId, occurredAt: "2026-09-06" },
      "1405-06",
    );

    const updated = await expensesService.update(userId, expense.id, {
      occurredAt: null,
    });

    expect(updated.occurredAt).toBeNull();
    expect(updated.monthKey).toBe(expense.monthKey);
  });

  it("changing the date re-derives the month", async () => {
    const userId = await fx.signUp();
    const categoryId = await systemCategory(userId, "groceries");
    const expense = await expensesService.create(
      userId,
      { amountToman: 1, title: "میوه", categoryId, occurredAt: "2026-09-06" },
      "1405-06",
    );

    const updated = await expensesService.update(userId, expense.id, {
      occurredAt: "2026-08-25",
    });

    expect(updated.monthKey).toBe(monthKeyOf("2026-08-25"));
  });

  it("rejects empty updates, bad amounts and unknown/foreign ids", async () => {
    const userId = await fx.signUp();
    const categoryId = await systemCategory(userId, "groceries");
    const expense = await expensesService.create(
      userId,
      { amountToman: 1, title: "نان", categoryId },
      "1405-06",
    );

    await expect(expensesService.update(userId, expense.id, {})).rejects.toThrow(
      ValidationError,
    );
    await expect(
      expensesService.update(userId, expense.id, { amountToman: -5 }),
    ).rejects.toThrow(ValidationError);
    await expect(
      expensesService.update(userId, newId(), { title: "نان" }),
    ).rejects.toThrow(NotFoundError);
    await expect(
      expensesService.update(userId, expense.id, { categoryId: newId() }),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("expenseService.remove + listByMonth (ticket 22)", () => {
  it("deletes freely, 404s on unknown ids, and never unlearns", async () => {
    const userId = await fx.signUp();
    const categoryId = await systemCategory(userId, "groceries");
    const expense = await expensesService.create(
      userId,
      { amountToman: 5_000, title: "نان", categoryId },
      "1405-06",
    );
    const learnedBefore = await fx.db
      .select()
      .from(learnedKeys)
      .where(eq(learnedKeys.userId, userId));
    expect(learnedBefore.length).toBeGreaterThan(0);

    await expensesService.remove(userId, expense.id);

    await expect(
      expensesService.remove(userId, expense.id),
    ).rejects.toThrow(NotFoundError);
    const learnedAfter = await fx.db
      .select()
      .from(learnedKeys)
      .where(eq(learnedKeys.userId, userId));
    expect(learnedAfter).toEqual(learnedBefore);
    const remaining = await expensesService.listByMonth(userId, "1405-06");
    expect(remaining).toHaveLength(0);
  });

  it("lists one month's ledger: undated first, then by date, each with its category", async () => {
    const userId = await fx.signUp();
    const groceries = await systemCategory(userId, "groceries");
    const cafe = await systemCategory(userId, "cafe-restaurant");

    const datedLate = await expensesService.create(
      userId,
      { amountToman: 10_000, title: "نان", categoryId: groceries, occurredAt: "2026-09-05" },
      "1405-06",
    );
    const undated = await expensesService.create(
      userId,
      { amountToman: 20_000, title: "خرج جاافتاده", categoryId: groceries, occurredAt: null },
      "1405-06",
    );
    const datedEarly = await expensesService.create(
      userId,
      { amountToman: 30_000, title: "کافه", categoryId: cafe, occurredAt: "2026-08-25" },
      "1405-06",
    );
    const otherMonth = await expensesService.create(
      userId,
      { amountToman: 40_000, title: "قسط", categoryId: await systemCategory(userId, "installment"), occurredAt: "2026-10-01" },
      "1405-07",
    );

    const rows = await expensesService.listByMonth(userId, "1405-06");

    expect(rows.map((r) => r.id)).toEqual([undated.id, datedEarly.id, datedLate.id]);
    expect(rows[0]!.occurredAt).toBeNull();
    expect(rows[0]!.category.id).toBe(groceries);
    expect(rows[1]!.category.name).toBeTruthy();
    expect(rows.map((r) => r.monthKey)).toEqual(["1405-06", "1405-06", "1405-06"]);
    expect(rows.some((r) => r.id === otherMonth.id)).toBe(false);
  });

  it("is scoped to the user — another user's month stays invisible", async () => {
    const userId = await fx.signUp();
    const otherUser = await fx.signUp();
    const categoryId = await systemCategory(otherUser, "groceries");
    await expensesService.create(
      otherUser,
      { amountToman: 1, title: "نان", categoryId },
      "1405-06",
    );

    const rows = await expensesService.listByMonth(userId, "1405-06");
    expect(rows).toHaveLength(0);
  });

  it("rejects a malformed month key", async () => {
    const userId = await fx.signUp();
    await expect(expensesService.listByMonth(userId, "1405-6")).rejects.toThrow(
      ValidationError,
    );
  });
});

describe("expenseService.countByCategory (ticket 28: the delete guard's counter)", () => {
  it("counts every expense per category across all months, dated or not", async () => {
    const userId = await fx.signUp();
    const groceries = await systemCategory(userId, "groceries");
    const transport = await systemCategory(userId, "transport");
    const custom = await categories.create(userId, { name: "کتاب" });

    await expensesService.create(
      userId, { amountToman: 10_000, title: "نان", categoryId: groceries }, "1405-05",
    );
    await expensesService.create(
      userId, { amountToman: 20_000, title: "شیر", categoryId: groceries }, "1405-06",
    );
    await expensesService.create(
      userId,
      { amountToman: 5_000, title: "تاکسی", categoryId: transport, occurredAt: "2026-08-30" },
      "1405-05",
    );
    await expensesService.create(
      userId, { amountToman: 1_000, title: "کتاب", categoryId: custom.id }, "1405-06",
    );

    const counts = await expensesService.countByCategory(userId);
    expect(counts).toEqual({
      [groceries]: 2,
      [transport]: 1,
      [custom.id]: 1,
    });
  });

  it("is scoped to the user and empty for a fresh one", async () => {
    const userId = await fx.signUp();
    const other = await fx.signUp();
    const groceries = await systemCategory(other, "groceries");
    await expensesService.create(
      other, { amountToman: 3_000, title: "نان", categoryId: groceries }, "1405-06",
    );

    expect(await expensesService.countByCategory(userId)).toEqual({});
    expect(await expensesService.countByCategory(other)).toEqual({
      [groceries]: 1,
    });
  });
});
