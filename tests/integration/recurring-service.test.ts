import { afterAll, describe, expect, it, vi } from "vitest";
import { and, eq, isNotNull } from "drizzle-orm";
import { expenses, learnedKeys } from "@/db/schema";
import {
  addJalaliMonths,
  currentJalaliMonthKey,
  fromJalaliMonthKey,
  jalaliMonthKey,
} from "@/lib/jalali";
import {
  clampedDayOfMonth,
  jalaliMonthBounds,
  occurrenceISO,
} from "@/lib/recurring";
import { createCategoryService } from "@/lib/services/category-service";
import { createExpenseService } from "@/lib/services/expense-service";
import {
  createRecurringService,
  ensureRecurringExpensesGenerated,
  type CreateRecurringTemplateInput,
} from "@/lib/services/recurring-service";
import { NotFoundError, ValidationError } from "@/lib/services/errors";
import { setupIntegrationDb } from "../helpers/integration";

// Recurring service rules on a real temp libSQL file (ticket 23): lazy
// generation for the CURRENT Jalali month only (decision 14), preview for
// FUTURE months only (decision 15), template saves teach the engine but
// generation never does (decision 06), and a read never breaks because of
// generation.

const fx = await setupIntegrationDb("recurring-service");
const categories = createCategoryService(fx.db);
const recurring = createRecurringService(fx.db);
const expensesService = createExpenseService(fx.db);

afterAll(async () => {
  await fx.close();
});

async function systemCategory(userId: string, slug: string): Promise<string> {
  const category = (await categories.list(userId)).find((c) => c.slug === slug);
  if (!category) throw new Error(`system category ${slug} missing`);
  return category.id;
}

// The gates are relative to the real Tehran "now" — the service owns the
// clock; the tests only derive past/current/future month keys from it.
const CURRENT = currentJalaliMonthKey();
const monthShift = (key: string, n: number) =>
  jalaliMonthKey(addJalaliMonths(fromJalaliMonthKey(key), n));
const PREV = monthShift(CURRENT, -1);
const NEXT = monthShift(CURRENT, 1);

async function createTemplate(
  userId: string,
  over: Partial<CreateRecurringTemplateInput> = {},
) {
  return recurring.create(userId, {
    amountToman: 1_500_000,
    title: "قسط وام",
    categoryId: await systemCategory(userId, "installment"),
    dayOfMonth: 10,
    startDate: "2025-01-01",
    endDate: null,
    ...over,
  });
}

const generatedExpenses = (userId: string, monthKey: string) =>
  fx.db
    .select()
    .from(expenses)
    .where(
      and(
        eq(expenses.userId, userId),
        eq(expenses.monthKey, monthKey),
        isNotNull(expenses.sourceRecurringId),
      ),
    );

const learnedRows = (userId: string) =>
  fx.db.select().from(learnedKeys).where(eq(learnedKeys.userId, userId));

describe("recurringService.create — a template save teaches (decision 06)", () => {
  it("creates a template and fires learning with the final category", async () => {
    const userId = await fx.signUp();

    const template = await createTemplate(userId, { title: "قبض برق" });

    expect(template.active).toBe(true);
    expect(template.dayOfMonth).toBe(10);
    expect(template.endDate).toBeNull();
    const rows = await learnedRows(userId);
    expect(rows.length).toBeGreaterThan(0);
  });

  it("rejects invalid inputs with typed errors", async () => {
    const userId = await fx.signUp();
    const categoryId = await systemCategory(userId, "installment");
    const base = {
      amountToman: 1_500_000,
      title: "قسط وام",
      categoryId,
      dayOfMonth: 10,
      startDate: "2025-01-01",
      endDate: null,
    };

    await expect(recurring.create(userId, { ...base, amountToman: 0 })).rejects.toThrow(
      ValidationError,
    );
    await expect(recurring.create(userId, { ...base, dayOfMonth: 0 })).rejects.toThrow(
      ValidationError,
    );
    await expect(recurring.create(userId, { ...base, dayOfMonth: 32 })).rejects.toThrow(
      ValidationError,
    );
    await expect(recurring.create(userId, { ...base, title: "  " })).rejects.toThrow(
      ValidationError,
    );
    // format level
    await expect(
      recurring.create(userId, { ...base, startDate: "2025/01/01" }),
    ).rejects.toThrow(ValidationError);
    // real-calendar level (the date picker's fallback)
    await expect(
      recurring.create(userId, { ...base, startDate: "2026-02-30" }),
    ).rejects.toThrow(ValidationError);
    // the window must not end before it starts
    await expect(
      recurring.create(userId, { ...base, endDate: "2024-12-31" }),
    ).rejects.toThrow(ValidationError);
    // unknown or foreign category
    await expect(
      recurring.create(userId, { ...base, categoryId: "abc" }),
    ).rejects.toThrow(ValidationError);
    await expect(
      recurring.create(userId, {
        ...base,
        categoryId: await systemCategory(await fx.signUp(), "installment"),
      }),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("recurringService.update — final window validated, learning fires", () => {
  it("updates fields and learns the final title/category", async () => {
    const userId = await fx.signUp();
    const template = await createTemplate(userId);
    const before = (await learnedRows(userId)).length;

    const updated = await recurring.update(userId, template.id, {
      title: "قسط مسکن",
      amountToman: 2_000_000,
    });

    expect(updated.title).toBe("قسط مسکن");
    expect(updated.amountToman).toBe(2_000_000);
    expect((await learnedRows(userId)).length).toBeGreaterThan(before);
  });

  it("validates the FINAL window: endDate moved before the existing startDate", async () => {
    const userId = await fx.signUp();
    const template = await createTemplate(userId, { startDate: "2025-06-01" });

    await expect(
      recurring.update(userId, template.id, { endDate: "2025-01-01" }),
    ).rejects.toThrow(ValidationError);
    // moving startDate past an existing endDate fails the same way
    const bounded = await createTemplate(userId, {
      startDate: "2025-06-01",
      endDate: "2026-06-01",
    });
    await expect(
      recurring.update(userId, bounded.id, { startDate: "2030-01-01" }),
    ).rejects.toThrow(ValidationError);
  });

  it("toggles active — the pause/resume switch (ticket 23)", async () => {
    const userId = await fx.signUp();
    const template = await createTemplate(userId);

    const paused = await recurring.update(userId, template.id, { active: false });
    expect(paused.active).toBe(false);

    const resumed = await recurring.update(userId, template.id, { active: true });
    expect(resumed.active).toBe(true);
  });

  it("rejects empty updates and unknown/foreign ids", async () => {
    const userId = await fx.signUp();
    const template = await createTemplate(userId);

    await expect(recurring.update(userId, template.id, {})).rejects.toThrow(
      ValidationError,
    );
    await expect(
      recurring.update(userId, "abc", { title: "x" }),
    ).rejects.toThrow(ValidationError);
    await expect(
      recurring.update(userId, template.id, { categoryId: await systemCategory(await fx.signUp(), "groceries") }),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("recurringService.remove/get/list", () => {
  it("deletes freely; already-generated expenses survive as independent rows", async () => {
    const userId = await fx.signUp();
    const template = await createTemplate(userId);
    await ensureRecurringExpensesGenerated(fx.db, userId, CURRENT);
    expect(await generatedExpenses(userId, CURRENT)).toHaveLength(1);

    await recurring.remove(userId, template.id);

    // the generated expense is provenance-only: it outlives its template
    const ledger = await expensesService.listByMonth(userId, CURRENT);
    expect(ledger).toHaveLength(1);
    await expect(recurring.get(userId, template.id)).rejects.toThrow(NotFoundError);
  });

  it("404s unknown ids and stays scoped to the user", async () => {
    const userId = await fx.signUp();
    const other = await fx.signUp();
    const foreign = await createTemplate(other);

    await expect(recurring.get(userId, foreign.id)).rejects.toThrow(NotFoundError);
    const list = await recurring.list(userId);
    expect(list).toHaveLength(0);
    expect(await recurring.list(other)).toHaveLength(1);
  });
});

describe("ensureRecurringExpensesGenerated — lazy generation (decision 14)", () => {
  it("generates this month's due templates with standard expense fields", async () => {
    const userId = await fx.signUp();
    await createTemplate(userId, { dayOfMonth: 15 });
    const learnedBefore = await learnedRows(userId);

    const { generated } = await ensureRecurringExpensesGenerated(fx.db, userId, CURRENT);
    expect(generated).toBe(1);

    const [expense] = await generatedExpenses(userId, CURRENT);
    expect(expense!.title).toBe("قسط وام");
    expect(expense!.amountToman).toBe(1_500_000);
    expect(expense!.categoryId).toBe(await systemCategory(userId, "installment"));
    expect(expense!.monthKey).toBe(CURRENT);
    expect(expense!.occurredAt).toBe(occurrenceISO(CURRENT, 15));
    expect(expense!.note).toBeNull();
    expect(expense!.sourceRecurringId).toBeTruthy();

    // generation NEVER learns (decision 06)
    expect(await learnedRows(userId)).toEqual(learnedBefore);
  });

  it("twice in a row → zero duplicates; parallel calls → one row", async () => {
    const userId = await fx.signUp();
    await createTemplate(userId, { dayOfMonth: 10 });
    await createTemplate(userId, { dayOfMonth: 20, title: "قبض برق", amountToman: 300_000 });

    await ensureRecurringExpensesGenerated(fx.db, userId, CURRENT);
    const second = await ensureRecurringExpensesGenerated(fx.db, userId, CURRENT);
    expect(second.generated).toBe(0);

    await Promise.all([
      ensureRecurringExpensesGenerated(fx.db, userId, CURRENT),
      ensureRecurringExpensesGenerated(fx.db, userId, CURRENT),
    ]);
    const rows = await generatedExpenses(userId, CURRENT);
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.sourceRecurringId))).toHaveLength(2);
  });

  it("a mid-month template with a past day still generates this month (backdated)", async () => {
    const userId = await fx.signUp();
    // created "today", but its day is the 3rd and it starts this month
    await createTemplate(userId, {
      dayOfMonth: 3,
      startDate: occurrenceISO(CURRENT, 3),
    });

    await ensureRecurringExpensesGenerated(fx.db, userId, CURRENT);

    const [expense] = await generatedExpenses(userId, CURRENT);
    expect(expense!.monthKey).toBe(CURRENT);
    expect(expense!.occurredAt).toBe(occurrenceISO(CURRENT, 3));
  });

  it("past and future months never generate (no backfill — decision 14)", async () => {
    const userId = await fx.signUp();
    await createTemplate(userId);

    const past = await ensureRecurringExpensesGenerated(fx.db, userId, PREV);
    const future = await ensureRecurringExpensesGenerated(fx.db, userId, NEXT);
    expect(past.generated).toBe(0);
    expect(future.generated).toBe(0);
    expect(await generatedExpenses(userId, PREV)).toHaveLength(0);
    expect(await generatedExpenses(userId, NEXT)).toHaveLength(0);
  });

  it("skips templates the predicate excludes: paused, ended, not yet started", async () => {
    const userId = await fx.signUp();
    // PREV's last day < CURRENT's start; NEXT's start > CURRENT's end
    const paused = await createTemplate(userId, { dayOfMonth: 5 });
    await recurring.update(userId, paused.id, { active: false });
    await createTemplate(userId, {
      dayOfMonth: 5,
      title: "تمام‌شده",
      endDate: jalaliMonthBounds(PREV).endISO,
    });
    await createTemplate(userId, {
      dayOfMonth: 5,
      title: "آینده‌بنیان",
      startDate: jalaliMonthBounds(NEXT).startISO,
    });

    const { generated } = await ensureRecurringExpensesGenerated(fx.db, userId, CURRENT);
    expect(generated).toBe(0);
    expect(await generatedExpenses(userId, CURRENT)).toHaveLength(0);
  });

  it("an injected generation failure never breaks the read path", async () => {
    const userId = await fx.signUp();
    await createTemplate(userId);

    const brokenDb = new Proxy(fx.db, {
      get(target, prop, receiver) {
        if (prop === "insert") throw new Error("injected failure");
        return Reflect.get(target, prop, receiver);
      },
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      ensureRecurringExpensesGenerated(brokenDb, userId, CURRENT),
    ).resolves.toEqual({ generated: 0 });

    expect(errorSpy).toHaveBeenCalledOnce();
    errorSpy.mockRestore();
  });
});

describe("recurringService.preview — forecast rows (decision 15)", () => {
  it("lists active due templates for a FUTURE month with clamped, sorted days", async () => {
    const userId = await fx.signUp();
    const installment = await systemCategory(userId, "installment");
    await createTemplate(userId, { dayOfMonth: 10 });
    await createTemplate(userId, { dayOfMonth: 31, title: "اجاره", amountToman: 8_000_000 });
    // excluded from the forecast:
    const paused = await createTemplate(userId, { dayOfMonth: 5 });
    await recurring.update(userId, paused.id, { active: false });
    await createTemplate(userId, {
      dayOfMonth: 5,
      title: "تمام‌شده",
      startDate: "2025-01-01",
      endDate: jalaliMonthBounds(PREV).endISO, // ended before NEXT begins
    });

    const rows = await recurring.preview(userId, NEXT);

    expect(rows).toHaveLength(2);
    // ascending calendar order, each day clamped the same way generation clamps
    expect(rows.map((r) => r.title)).toEqual(["قسط وام", "اجاره"]);
    expect(rows[0]!.day).toBe(10);
    expect(rows[1]!.day).toBe(clampedDayOfMonth(31, NEXT));
    expect(rows.every((r) => r.categoryId === installment)).toBe(true);
    expect(rows.every((r) => r.templateId && r.amountToman > 0)).toBe(true);
  });

  it("current and past months have no forecast (decision 15)", async () => {
    const userId = await fx.signUp();
    await createTemplate(userId);

    expect(await recurring.preview(userId, CURRENT)).toEqual([]);
    expect(await recurring.preview(userId, PREV)).toEqual([]);
  });

  it("is scoped to the user and rejects a malformed month key", async () => {
    const userId = await fx.signUp();
    const other = await fx.signUp();
    await createTemplate(other);

    expect(await recurring.preview(userId, NEXT)).toEqual([]);
    await expect(recurring.preview(userId, "1405-7")).rejects.toThrow(ValidationError);
  });
});
