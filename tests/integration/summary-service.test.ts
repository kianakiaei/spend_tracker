import { afterAll, describe, expect, it } from "vitest";
import { jalaliMonthBounds } from "@/lib/recurring";
import { createCategoryService } from "@/lib/services/category-service";
import {
  createExpenseService,
  type CreateExpenseInput,
} from "@/lib/services/expense-service";
import { createRecurringService } from "@/lib/services/recurring-service";
import type { CreateRecurringTemplateInput } from "@/lib/services/recurring-service";
import { createSummaryService } from "@/lib/services/summary-service";
import { ValidationError } from "@/lib/services/errors";
import type { DomainDb } from "@/lib/services/types";
import {
  generatedExpenses,
  relativeMonthKeys,
  systemCategoryBySlug,
} from "../helpers/fixtures";
import { setupIntegrationDb } from "../helpers/integration";

// Summary service rules on a real temp libSQL file (ticket 24): the ticket-12
// shape with decision 15's additive forecast composition for FUTURE Jalali
// months, decision 14's ensure-before-read for the CURRENT month only (past
// months never generate, never forecast), and the SQL-side aggregation
// (GROUP BY categoryId — the month's expense rows never reach memory).

const fx = await setupIntegrationDb("summary-service");
const categories = createCategoryService(fx.db);
const recurring = createRecurringService(fx.db);
const expensesService = createExpenseService(fx.db);
const summaries = createSummaryService(fx.db);

afterAll(async () => {
  await fx.close();
});

// The gates are relative to the real Tehran "now" — the service owns the
// clock; the tests only derive past/current/future month keys from it.
const { CURRENT, PREV, NEXT, monthShift } = relativeMonthKeys();

async function createExpense(
  userId: string,
  over: Partial<CreateExpenseInput> = {},
  entryMonthKey = CURRENT,
) {
  return expensesService.create(
    userId,
    {
      amountToman: 250_000,
      title: "خرید هفتگی",
      categoryId: (await systemCategoryBySlug(fx.db, userId, "groceries")).id,
      // dated inside the entry month; undated via the `over` escape hatch
      occurredAt: jalaliMonthBounds(entryMonthKey).startISO,
      ...over,
    },
    entryMonthKey,
  );
}

async function createTemplate(
  userId: string,
  over: Partial<CreateRecurringTemplateInput> = {},
) {
  return recurring.create(userId, {
    amountToman: 1_500_000,
    title: "قسط وام",
    categoryId: (await systemCategoryBySlug(fx.db, userId, "installment")).id,
    dayOfMonth: 10,
    startDate: "2025-01-01",
    endDate: null,
    ...over,
  });
}

/** Proxy spy (ticket 23's injected-failure trick, counting instead of
 * breaking): counts `insert` builder accesses — in these services exactly
 * one per INSERT statement issued. The observable of "ensure ran before the
 * read" vs "never ran". */
function insertCountingDb(base: DomainDb): { db: DomainDb; count(): number } {
  let inserts = 0;
  const counting = new Proxy(base, {
    get(target, prop, receiver) {
      if (prop === "insert") inserts += 1;
      return Reflect.get(target, prop, receiver);
    },
  });
  return { db: counting, count: () => inserts };
}

describe("summaryService.getSummary — current month: ensure before read (decision 14)", () => {
  it("generates due templates BEFORE reading — the summary includes them, with no forecast field", async () => {
    const userId = await fx.signUp();
    const installment = await systemCategoryBySlug(fx.db, userId, "installment");
    await createTemplate(userId); // due this month — nothing generated yet
    const spy = insertCountingDb(fx.db);
    const spySummaries = createSummaryService(spy.db);

    const summary = await spySummaries.getSummary(userId, CURRENT);

    // the insert happened before the read, and exactly once — a second read
    // finds nothing missing (zero writes, decision 14's steady state)
    expect(spy.count()).toBe(1);
    expect(await generatedExpenses(fx.db, userId, CURRENT)).toHaveLength(1);

    expect(summary.monthKey).toBe(CURRENT);
    expect("forecastToman" in summary).toBe(false);
    expect(summary.totalToman).toBe(1_500_000);
    expect(summary.byCategory).toEqual([
      {
        categoryId: installment.id,
        name: installment.name,
        totalToman: 1_500_000,
        count: 1,
      },
    ]);

    const steadyState = insertCountingDb(fx.db);
    const again = await createSummaryService(steadyState.db).getSummary(userId, CURRENT);
    expect(steadyState.count()).toBe(0);
    expect(again).toEqual(summary);
  });
});

describe("summaryService.getSummary — past month: recorded only", () => {
  it("never ensures, never forecasts — a missed month stays empty", async () => {
    const userId = await fx.signUp();
    const groceries = await systemCategoryBySlug(fx.db, userId, "groceries");
    await createExpense(userId, {}, PREV); // recorded in PREV
    await createTemplate(userId, { dayOfMonth: 5 }); // due in PREV too
    const spy = insertCountingDb(fx.db);
    const spySummaries = createSummaryService(spy.db);

    const summary = await spySummaries.getSummary(userId, PREV);

    expect(spy.count()).toBe(0); // ensure never even ran
    expect(await generatedExpenses(fx.db, userId, PREV)).toHaveLength(0);
    expect("forecastToman" in summary).toBe(false);
    expect(summary.monthKey).toBe(PREV);
    expect(summary.totalToman).toBe(250_000);
    expect(summary.byCategory).toEqual([
      {
        categoryId: groceries.id,
        name: groceries.name,
        totalToman: 250_000,
        count: 1,
      },
    ]);
  });
});

describe("summaryService.getSummary — future month: composite (decision 15)", () => {
  it("adds the active due templates on top of the recorded expenses, additively", async () => {
    const userId = await fx.signUp();
    const groceries = await systemCategoryBySlug(fx.db, userId, "groceries");
    const bills = await systemCategoryBySlug(fx.db, userId, "bills-internet");
    await createExpense(userId, { amountToman: 200_000 }, NEXT);
    const custom = await categories.create(userId, { name: "هدیه" });
    await createExpense(
      userId,
      { amountToman: 120_000, title: "هدیه تولد", categoryId: custom.id },
      NEXT,
    );
    // two forecast rows — one merges into the recorded groceries tile, one
    // gets its own category
    await createTemplate(userId, {
      title: "سبد ماهانه",
      amountToman: 1_000_000,
      categoryId: groceries.id,
      dayOfMonth: 3,
    });
    await createTemplate(userId, {
      title: "قبض اینترنت",
      amountToman: 450_000,
      categoryId: bills.id,
      dayOfMonth: 17,
    });
    // excluded from the forecast by the shared ticket-23 predicate:
    const paused = await createTemplate(userId, { title: "مکث‌شده", dayOfMonth: 8 });
    await recurring.update(userId, paused.id, { active: false });
    await createTemplate(userId, {
      title: "تمام‌شده",
      dayOfMonth: 8,
      endDate: jalaliMonthBounds(PREV).endISO, // ended before NEXT begins
    });
    await createTemplate(userId, {
      title: "دیرتر",
      dayOfMonth: 8,
      startDate: jalaliMonthBounds(monthShift(NEXT, 1)).startISO, // after NEXT ends
    });

    const summary = await summaries.getSummary(userId, NEXT);

    expect(summary.monthKey).toBe(NEXT);
    expect(summary.forecastToman).toBe(1_450_000);
    expect(summary.totalToman).toBe(200_000 + 120_000 + 1_450_000);
    // tiles in category order (system seeds first, customs last); the merged
    // row's count stays the RECORDED count — forecasts are not expenses
    expect(summary.byCategory).toEqual([
      {
        categoryId: groceries.id,
        name: groceries.name,
        totalToman: 1_200_000,
        count: 1,
      },
      {
        categoryId: bills.id,
        name: bills.name,
        totalToman: 450_000,
        count: 0,
      },
      {
        categoryId: custom.id,
        name: "هدیه",
        totalToman: 120_000,
        count: 1,
      },
    ]);
  });

  it("a future month with no due templates still carries forecastToman = 0", async () => {
    const userId = await fx.signUp();
    await createExpense(userId, { amountToman: 90_000 }, NEXT);

    const summary = await summaries.getSummary(userId, NEXT);

    expect(summary.forecastToman).toBe(0);
    expect(summary.totalToman).toBe(90_000);
    expect(summary.byCategory).toHaveLength(1);
  });

  it("an undated expense is a member of its entry month (decision 15)", async () => {
    const userId = await fx.signUp();
    const groceriesId = (await systemCategoryBySlug(fx.db, userId, "groceries")).id;
    await expensesService.create(
      userId,
      {
        amountToman: 75_000,
        title: "خرج بی‌تاریخ",
        categoryId: groceriesId,
        occurredAt: null,
      },
      NEXT,
    );

    const summary = await summaries.getSummary(userId, NEXT);

    expect(summary.totalToman).toBe(75_000);
    expect(summary.byCategory[0]).toMatchObject({
      categoryId: groceriesId,
      count: 1,
      totalToman: 75_000,
    });
  });

  it("is scoped to the user and rejects a malformed month key", async () => {
    const userId = await fx.signUp();
    const other = await fx.signUp();
    await createExpense(other, { amountToman: 500_000 }, NEXT);
    await createTemplate(other, { amountToman: 700_000 });

    const summary = await summaries.getSummary(userId, NEXT);
    expect(summary.totalToman).toBe(0);
    expect(summary.forecastToman).toBe(0);
    expect(summary.byCategory).toEqual([]);

    await expect(summaries.getSummary(userId, "1405-6")).rejects.toThrow(
      ValidationError,
    );
  });
});

describe("expenseService.listByMonth — the second ensure call-site (decision 14)", () => {
  it("triggers generation ONLY when the requested month is the current one", async () => {
    const userId = await fx.signUp();
    await createTemplate(userId, { dayOfMonth: 12 });
    const spy = insertCountingDb(fx.db);
    const ledger = createExpenseService(spy.db);

    // past: never generates (no backfill) — future: never (preview territory)
    await ledger.listByMonth(userId, PREV);
    await ledger.listByMonth(userId, NEXT);
    expect(spy.count()).toBe(0);
    expect(await generatedExpenses(fx.db, userId, CURRENT)).toHaveLength(0);

    // current: generates before reading — the ledger already has the row
    const rows = await ledger.listByMonth(userId, CURRENT);
    expect(spy.count()).toBe(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.sourceRecurringId).toBeTruthy();
  });

  it("recording a fresh expense is NOT an ensure call-site", async () => {
    const userId = await fx.signUp();
    await createTemplate(userId);

    await createExpense(userId); // a write — must not generate

    expect(await generatedExpenses(fx.db, userId, CURRENT)).toHaveLength(0);
  });
});
