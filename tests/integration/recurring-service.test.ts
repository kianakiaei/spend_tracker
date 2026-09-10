import { afterAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { learnedKeys, recurringTemplates } from "@/db/schema";
import {
  clampedDayOfMonth,
  jalaliMonthBounds,
  occurrenceISO,
} from "@/lib/recurring";
import {
  fromISODate,
  jalaliMonthKey,
  shiftJalaliMonthKey,
} from "@/lib/jalali";
import { newId } from "@/lib/id";
import { createExpenseService } from "@/lib/services/expense-service";
import {
  createRecurringService,
  ensureRecurringExpensesGenerated,
  type CreateRecurringTemplateInput,
} from "@/lib/services/recurring-service";
import { NotFoundError, ValidationError } from "@/lib/services/errors";
import {
  generatedExpenses,
  relativeMonthKeys,
  systemCategoryBySlug,
} from "../helpers/fixtures";
import { setupIntegrationDb } from "../helpers/integration";

// Recurring service rules on a real temp libSQL file (ticket 23): lazy
// generation for the CURRENT Jalali month on reads (decision 14), preview
// for FUTURE months only (decision 15), backfill of past months on template
// writes, template saves teach the engine but generation never does
// (decision 06), and a read never breaks because of generation.

const fx = await setupIntegrationDb("recurring-service");
const recurring = createRecurringService(fx.db);
const expensesService = createExpenseService(fx.db);

afterAll(async () => {
  await fx.close();
});

// The gates are relative to the real Tehran "now" — the service owns the
// clock; the tests only derive past/current/future month keys from it.
const { CURRENT, PREV, NEXT } = relativeMonthKeys();

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

/** A template row straight into the DB — bypasses the service so the
 * ensure (read-path) tests never trip the write-side backfill. */
async function insertTemplateRow(
  userId: string,
  over: Partial<CreateRecurringTemplateInput> = {},
) {
  const now = new Date();
  const [row] = await fx.db
    .insert(recurringTemplates)
    .values({
      id: newId(),
      amountToman: 1_500_000,
      title: "قسط وام",
      categoryId: (await systemCategoryBySlug(fx.db, userId, "installment")).id,
      dayOfMonth: 10,
      startDate: "2025-01-01",
      endDate: null,
      active: true,
      userId,
      createdAt: now,
      updatedAt: now,
      ...over,
    })
    .returning();
  return row!;
}

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
    const categoryId = (await systemCategoryBySlug(fx.db, userId, "installment")).id;
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
        categoryId: (await systemCategoryBySlug(fx.db, await fx.signUp(), "installment")).id,
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
      recurring.update(userId, template.id, { categoryId: (await systemCategoryBySlug(fx.db, await fx.signUp(), "groceries")).id }),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("recurringService.remove/get/list", () => {
  it("deletes freely; already-generated expenses survive as independent rows", async () => {
    const userId = await fx.signUp();
    const template = await createTemplate(userId);
    await ensureRecurringExpensesGenerated(fx.db, userId, CURRENT);
    expect(await generatedExpenses(fx.db, userId, CURRENT)).toHaveLength(1);

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
    await insertTemplateRow(userId, { dayOfMonth: 15 });
    const learnedBefore = await learnedRows(userId);

    const { generated } = await ensureRecurringExpensesGenerated(fx.db, userId, CURRENT);
    expect(generated).toBe(1);

    const [expense] = await generatedExpenses(fx.db, userId, CURRENT);
    expect(expense!.title).toBe("قسط وام");
    expect(expense!.amountToman).toBe(1_500_000);
    expect(expense!.categoryId).toBe((await systemCategoryBySlug(fx.db, userId, "installment")).id);
    expect(expense!.monthKey).toBe(CURRENT);
    expect(expense!.occurredAt).toBe(occurrenceISO(CURRENT, 15));
    expect(expense!.note).toBeNull();
    expect(expense!.sourceRecurringId).toBeTruthy();

    // generation NEVER learns (decision 06)
    expect(await learnedRows(userId)).toEqual(learnedBefore);
  });

  it("twice in a row → zero duplicates; parallel calls → one row", async () => {
    const userId = await fx.signUp();
    await insertTemplateRow(userId, { dayOfMonth: 10 });
    await insertTemplateRow(userId, { dayOfMonth: 20, title: "قبض برق", amountToman: 300_000 });

    await ensureRecurringExpensesGenerated(fx.db, userId, CURRENT);
    const second = await ensureRecurringExpensesGenerated(fx.db, userId, CURRENT);
    expect(second.generated).toBe(0);

    await Promise.all([
      ensureRecurringExpensesGenerated(fx.db, userId, CURRENT),
      ensureRecurringExpensesGenerated(fx.db, userId, CURRENT),
    ]);
    const rows = await generatedExpenses(fx.db, userId, CURRENT);
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.sourceRecurringId))).toHaveLength(2);
  });

  it("a mid-month template with a past day still generates this month (backdated)", async () => {
    const userId = await fx.signUp();
    // inserted "today", but its day is the 3rd and it starts this month
    await insertTemplateRow(userId, {
      dayOfMonth: 3,
      startDate: occurrenceISO(CURRENT, 3),
    });

    await ensureRecurringExpensesGenerated(fx.db, userId, CURRENT);

    const [expense] = await generatedExpenses(fx.db, userId, CURRENT);
    expect(expense!.monthKey).toBe(CURRENT);
    expect(expense!.occurredAt).toBe(occurrenceISO(CURRENT, 3));
  });

  it("reads never generate past or future months — the ensure gate is current-only", async () => {
    const userId = await fx.signUp();
    // Starts next month: due nowhere at or before CURRENT, so the write
    // backfills nothing and the read gate is what is under test.
    await createTemplate(userId, {
      startDate: jalaliMonthBounds(NEXT).startISO,
    });

    const past = await ensureRecurringExpensesGenerated(fx.db, userId, PREV);
    const future = await ensureRecurringExpensesGenerated(fx.db, userId, NEXT);
    expect(past.generated).toBe(0);
    expect(future.generated).toBe(0);
    expect(await generatedExpenses(fx.db, userId, PREV)).toHaveLength(0);
    expect(await generatedExpenses(fx.db, userId, NEXT)).toHaveLength(0);
  });

  it("skips templates the predicate excludes: paused, ended, not yet started", async () => {
    const userId = await fx.signUp();
    // PREV's last day < CURRENT's start; NEXT's start > CURRENT's end.
    // Starts sit outside CURRENT so the service create backfills nothing —
    // the CURRENT emptiness below is the ensure gate's doing alone.
    const paused = await createTemplate(userId, {
      dayOfMonth: 5,
      startDate: jalaliMonthBounds(NEXT).startISO,
    });
    await recurring.update(userId, paused.id, { active: false });
    await createTemplate(userId, {
      dayOfMonth: 5,
      title: "تمام‌شده",
      startDate: jalaliMonthBounds(PREV).startISO,
      endDate: jalaliMonthBounds(PREV).endISO,
    });
    await createTemplate(userId, {
      dayOfMonth: 5,
      title: "آینده‌بنیان",
      startDate: jalaliMonthBounds(NEXT).startISO,
    });

    const { generated } = await ensureRecurringExpensesGenerated(fx.db, userId, CURRENT);
    expect(generated).toBe(0);
    expect(await generatedExpenses(fx.db, userId, CURRENT)).toHaveLength(0);
  });

  it("an injected generation failure never breaks the read path (insert or select)", async () => {
    const userId = await fx.signUp();
    await insertTemplateRow(userId);

    const brokenDb = (breaking: string) =>
      new Proxy(fx.db, {
        get(target, prop, receiver) {
          if (prop === breaking) throw new Error("injected failure");
          return Reflect.get(target, prop, receiver);
        },
      });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // the insert phase fails: templates were found, expense write is lost
    await expect(
      ensureRecurringExpensesGenerated(brokenDb("insert"), userId, CURRENT),
    ).resolves.toEqual({ generated: 0 });
    // the select phase fails: nothing was read, nothing generated
    await expect(
      ensureRecurringExpensesGenerated(brokenDb("select"), userId, CURRENT),
    ).resolves.toEqual({ generated: 0 });
    expect(errorSpy).toHaveBeenCalledTimes(2);

    errorSpy.mockRestore();
    // the shield heals: the same (unbroken) db retries for free
    const healed = await ensureRecurringExpensesGenerated(fx.db, userId, CURRENT);
    expect(healed.generated).toBe(1);
  });
});

describe("template writes backfill past months from the start date", () => {
  /** Every Jalali month key from `from` through `to`, inclusive. */
  function monthRange(from: string, to: string): string[] {
    const out: string[] = [];
    for (let m = from; m <= to; m = shiftJalaliMonthKey(m, 1)) out.push(m);
    return out;
  }

  it("create with a past start fills every due month through the current one", async () => {
    const userId = await fx.signUp();
    const startISO = jalaliMonthBounds(PREV).startISO;
    await createTemplate(userId, { dayOfMonth: 10, startDate: startISO });

    const months = monthRange(jalaliMonthKey(fromISODate(startISO)), CURRENT);
    expect(months.length).toBeGreaterThan(1);
    for (const monthKey of months) {
      const rows = await generatedExpenses(fx.db, userId, monthKey);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.occurredAt).toBe(occurrenceISO(monthKey, 10));
      expect(rows[0]!.amountToman).toBe(1_500_000);
    }
  });

  it("create with a future start generates nothing yet", async () => {
    const userId = await fx.signUp();
    await createTemplate(userId, {
      startDate: jalaliMonthBounds(NEXT).startISO,
    });

    expect(await generatedExpenses(fx.db, userId, CURRENT)).toHaveLength(0);
    expect(await generatedExpenses(fx.db, userId, NEXT)).toHaveLength(0);
  });

  it("an unrelated update adds no rows — backfill is idempotent", async () => {
    const userId = await fx.signUp();
    const template = await createTemplate(userId, {
      startDate: jalaliMonthBounds(PREV).startISO,
    });
    const before = await generatedExpenses(fx.db, userId, CURRENT);

    await recurring.update(userId, template.id, { title: "قسط وام بازنویسی" });

    expect(await generatedExpenses(fx.db, userId, CURRENT)).toEqual(before);
    expect(await generatedExpenses(fx.db, userId, PREV)).toHaveLength(1);
  });

  it("moving the start earlier fills only the newly covered months", async () => {
    const userId = await fx.signUp();
    const template = await createTemplate(userId, {
      startDate: jalaliMonthBounds(CURRENT).startISO,
    });
    expect(await generatedExpenses(fx.db, userId, CURRENT)).toHaveLength(1);
    expect(await generatedExpenses(fx.db, userId, PREV)).toHaveLength(0);

    await recurring.update(userId, template.id, {
      startDate: jalaliMonthBounds(PREV).startISO,
    });

    const prev = await generatedExpenses(fx.db, userId, PREV);
    expect(prev).toHaveLength(1);
    expect(prev[0]!.occurredAt).toBe(occurrenceISO(PREV, 10));
    // the current month keeps its single row — no duplicate
    expect(await generatedExpenses(fx.db, userId, CURRENT)).toHaveLength(1);
  });

  it("the end date bounds the backfill", async () => {
    const userId = await fx.signUp();
    await createTemplate(userId, {
      startDate: jalaliMonthBounds(PREV).startISO,
      endDate: jalaliMonthBounds(PREV).endISO,
    });

    expect(await generatedExpenses(fx.db, userId, PREV)).toHaveLength(1);
    expect(await generatedExpenses(fx.db, userId, CURRENT)).toHaveLength(0);
  });

  it("a paused template backfills nothing on update", async () => {
    const userId = await fx.signUp();
    const template = await createTemplate(userId, {
      startDate: jalaliMonthBounds(NEXT).startISO,
    });
    await recurring.update(userId, template.id, { active: false });

    await recurring.update(userId, template.id, {
      startDate: jalaliMonthBounds(PREV).startISO,
    });

    expect(await generatedExpenses(fx.db, userId, PREV)).toHaveLength(0);
    expect(await generatedExpenses(fx.db, userId, CURRENT)).toHaveLength(0);
  });

  it("backfill never teaches — generation stays learning-free", async () => {
    const userId = await fx.signUp();
    await createTemplate(userId, {
      startDate: jalaliMonthBounds(PREV).startISO,
    });
    const shape = (await learnedRows(userId)).map((r) => [r.key, r.count]);

    const other = await fx.signUp();
    await createTemplate(other, {
      startDate: jalaliMonthBounds(NEXT).startISO,
    });
    // one learnOnSave per save in both cases — the filled months add none
    // (category ids differ per user, so only keys and counters compare)
    expect(
      (await learnedRows(other)).map((r) => [r.key, r.count]),
    ).toEqual(shape);
    expect(shape.length).toBeGreaterThan(0);
  });
});

describe("recurringService.preview — forecast rows (decision 15)", () => {
  it("lists active due templates for a FUTURE month with clamped, sorted days", async () => {
    const userId = await fx.signUp();
    const installmentId = (await systemCategoryBySlug(fx.db, userId, "installment")).id;
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
    expect(rows.every((r) => r.categoryId === installmentId)).toBe(true);
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

describe("recurringService.countByCategory (ticket 28: the delete guard's counter)", () => {
  it("counts templates per category — paused ones still block a delete", async () => {
    const userId = await fx.signUp();
    const installment = (await systemCategoryBySlug(fx.db, userId, "installment")).id;
    const groceries = (await systemCategoryBySlug(fx.db, userId, "groceries")).id;

    await createTemplate(userId); // installment
    const paused = await createTemplate(userId, {
      title: "اشتراک گیاه‌پزشکی",
      categoryId: groceries,
    });
    await recurring.update(userId, paused.id, { active: false });

    expect(await recurring.countByCategory(userId)).toEqual({
      [installment]: 1,
      [groceries]: 1,
    });
  });

  it("is scoped to the user and empty for a fresh one", async () => {
    const userId = await fx.signUp();
    const other = await fx.signUp();
    await createTemplate(other);

    expect(await recurring.countByCategory(userId)).toEqual({});
    expect(Object.keys(await recurring.countByCategory(other))).toHaveLength(1);
  });
});
