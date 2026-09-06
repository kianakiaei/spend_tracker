import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { categories, expenses } from "@/db/schema";
import { newId } from "@/lib/id";
import { fromISODate, jalaliMonthKey } from "@/lib/jalali";
import {
  amountTomanSchema,
  dateOnlySchema,
  jalaliMonthKeySchema,
  titleSchema,
  uuidv7Schema,
} from "@/lib/schemas";
import { getOwnedCategory } from "./category-service";
import { NotFoundError, ValidationError } from "./errors";
import { learnOnSave } from "./learning";
import { parseOrThrow } from "./parse";
import type { DomainDb, Expense, ExpenseWithCategory } from "./types";

// Expense service (ticket 22): create/update/delete are free — NO date
// constraints at all, past/future/undated all allowed (ticket 15). The only
// rule is the monthKey on write: dated expenses derive it from occurredAt
// via the jalali module; an UNDATED expense is a member of the month the
// form was opened in — the explicit `entryMonthKey` parameter. Every save
// (create/update) fires the learning pipeline with the final category.

const createExpenseInputSchema = z.object({
  amountToman: amountTomanSchema,
  title: titleSchema,
  note: z.string().nullish(),
  categoryId: uuidv7Schema,
  occurredAt: dateOnlySchema.nullish(),
});

const updateExpenseInputSchema = z.object({
  amountToman: amountTomanSchema.optional(),
  title: titleSchema.optional(),
  note: z.string().nullish(),
  categoryId: uuidv7Schema.optional(),
  occurredAt: dateOnlySchema.nullish(),
});

/** Jalali month of a date-only string — real-calendar validity included
 * (2026-02-30 is rejected here, not just 2026-13-40). */
function monthKeyOf(occurredAt: string): string {
  try {
    return jalaliMonthKey(fromISODate(occurredAt));
  } catch {
    throw new ValidationError(`not a real calendar date: ${occurredAt}`);
  }
}

export interface CreateExpenseInput {
  amountToman: number;
  title: string;
  note?: string | null;
  categoryId: string;
  occurredAt?: string | null;
}

export interface UpdateExpenseInput {
  amountToman?: number;
  title?: string;
  note?: string | null;
  categoryId?: string;
  occurredAt?: string | null;
}

export interface ExpenseService {
  /**
   * `entryMonthKey` is the month the form was opened in ("ماه فرم") — used
   * only for undated expenses; a dated expense always lands in its own
   * date's month, even when it differs from the form's month (ticket 15).
   * Fires learning with the final category.
   */
  create(
    userId: string,
    input: CreateExpenseInput,
    entryMonthKey: string,
  ): Promise<Expense>;
  /**
   * Giving a date to an undated expense moves it to that date's month.
   * Clearing the date keeps the expense in the month it currently belongs
   * to (the undated↔undated month move is deliberately not a thing —
   * ticket 15). Fires learning with the final title/category.
   */
  update(userId: string, id: string, input: UpdateExpenseInput): Promise<Expense>;
  /** Free delete; learning is never rolled back (ticket 06). */
  remove(userId: string, id: string): Promise<void>;
  /** A month's ledger: undated expenses first (the «بدون تاریخ» chip is the
   * UI's), then by occurrence date, insertion order as the tie-break. */
  listByMonth(userId: string, monthKey: string): Promise<ExpenseWithCategory[]>;
}

export function createExpenseService(db: DomainDb): ExpenseService {
  async function getOwned(userId: string, id: string): Promise<Expense> {
    parseOrThrow(uuidv7Schema, id, "expense id");
    const [expense] = await db
      .select()
      .from(expenses)
      .where(and(eq(expenses.id, id), eq(expenses.userId, userId)))
      .limit(1);
    if (!expense) throw new NotFoundError(`expense ${id} not found`);
    return expense;
  }

  return {
    async create(userId, input, entryMonthKey) {
      const data = parseOrThrow(createExpenseInputSchema, input, "expense input");
      parseOrThrow(jalaliMonthKeySchema, entryMonthKey, "entry month");
      await getOwnedCategory(db, userId, data.categoryId);

      const occurredAt = data.occurredAt ?? null;
      const now = new Date();
      const [expense] = await db
        .insert(expenses)
        .values({
          id: newId(),
          amountToman: data.amountToman,
          title: data.title,
          note: data.note ?? null,
          categoryId: data.categoryId,
          occurredAt,
          // dated → derived from the date; undated → the form's month
          monthKey: occurredAt === null ? entryMonthKey : monthKeyOf(occurredAt),
          sourceRecurringId: null,
          userId,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      await learnOnSave(db, userId, data.title, data.categoryId);
      return expense!;
    },

    async update(userId, id, input) {
      const data = parseOrThrow(updateExpenseInputSchema, input, "expense input");
      if (Object.keys(data).length === 0) {
        throw new ValidationError("empty expense update");
      }
      const existing = await getOwned(userId, id);
      if (data.categoryId !== undefined) {
        await getOwnedCategory(db, userId, data.categoryId);
      }

      const occurredAt =
        data.occurredAt !== undefined ? (data.occurredAt ?? null) : existing.occurredAt;
      // Undated keeps the month it is in; dated always follows its date.
      const monthKey =
        occurredAt === null ? existing.monthKey : monthKeyOf(occurredAt);

      const set: {
        amountToman?: number;
        title?: string;
        note?: string | null;
        categoryId?: string;
        updatedAt: Date;
      } = { updatedAt: new Date() };
      if (data.amountToman !== undefined) set.amountToman = data.amountToman;
      if (data.title !== undefined) set.title = data.title;
      if (data.note !== undefined) set.note = data.note;
      if (data.categoryId !== undefined) set.categoryId = data.categoryId;

      const [expense] = await db
        .update(expenses)
        .set({ ...set, occurredAt, monthKey })
        .where(eq(expenses.id, id))
        .returning();

      const title = data.title ?? existing.title;
      const categoryId = data.categoryId ?? existing.categoryId;
      await learnOnSave(db, userId, title, categoryId);
      return expense!;
    },

    async remove(userId, id) {
      await getOwned(userId, id);
      await db.delete(expenses).where(eq(expenses.id, id));
    },

    async listByMonth(userId, monthKey) {
      parseOrThrow(jalaliMonthKeySchema, monthKey, "month key");

      const rows = await db
        .select({ expense: expenses, category: categories })
        .from(expenses)
        .innerJoin(categories, eq(categories.id, expenses.categoryId))
        .where(and(eq(expenses.userId, userId), eq(expenses.monthKey, monthKey)))
        // SQLite ASC sorts NULL first — undated on top of the ledger, then
        // chronological (ticket 15's display order).
        .orderBy(asc(expenses.occurredAt), asc(expenses.createdAt), asc(expenses.id));

      return rows.map((row) => ({ ...row.expense, category: row.category }));
    },
  };
}
