import { and, asc, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { expenses, recurringTemplates } from "@/db/schema";
import { newId } from "@/lib/id";
import { currentJalaliMonthKey, fromISODate } from "@/lib/jalali";
import {
  isTemplateDueInMonth,
  monthPosition,
  occurrenceISO,
  toForecastRow,
  type RecurringForecastRow,
} from "@/lib/recurring";
import {
  amountTomanSchema,
  dateOnlySchema,
  dayOfMonthSchema,
  jalaliMonthKeySchema,
  titleSchema,
  uuidv7Schema,
} from "@/lib/schemas";
import { getOwnedCategory } from "./category-service";
import { NotFoundError, ValidationError } from "./errors";
import { learnOnSave } from "./learning";
import { parseOrThrow } from "./parse";
import type { DomainDb, RecurringTemplate } from "./types";

// Recurring-template service (ticket 23; decisions 05/06/14/15). Creating or
// editing a template is an expense-like save: the learning pipeline fires
// with the final title/category — but GENERATION never teaches (decision 06).
// The lazy generate gate (ensure) is the current Jalali month only: past
// months stay empty forever (no backfill), future months belong to preview.
// A read never breaks because of generation: ensure swallows + logs, and the
// next request retries for free — idempotent via the
// (userId, sourceRecurringId, monthKey) unique index.

const createTemplateInputSchema = z.object({
  amountToman: amountTomanSchema,
  title: titleSchema,
  categoryId: uuidv7Schema,
  dayOfMonth: dayOfMonthSchema,
  startDate: dateOnlySchema,
  endDate: dateOnlySchema.nullish(),
});

const updateTemplateInputSchema = z.object({
  amountToman: amountTomanSchema.optional(),
  title: titleSchema.optional(),
  categoryId: uuidv7Schema.optional(),
  dayOfMonth: dayOfMonthSchema.optional(),
  startDate: dateOnlySchema.optional(),
  endDate: dateOnlySchema.nullish(),
  active: z.boolean().optional(),
});

export interface CreateRecurringTemplateInput {
  amountToman: number;
  title: string;
  categoryId: string;
  dayOfMonth: number;
  startDate: string;
  endDate?: string | null;
}

export interface UpdateRecurringTemplateInput {
  amountToman?: number;
  title?: string;
  categoryId?: string;
  dayOfMonth?: number;
  startDate?: string;
  endDate?: string | null;
  active?: boolean;
}

export interface RecurringService {
  /** All of the user's templates in creation order. */
  list(userId: string): Promise<RecurringTemplate[]>;
  get(userId: string, id: string): Promise<RecurringTemplate>;
  create(userId: string, input: CreateRecurringTemplateInput): Promise<RecurringTemplate>;
  update(
    userId: string,
    id: string,
    input: UpdateRecurringTemplateInput,
  ): Promise<RecurringTemplate>;
  /** Free delete — already-generated expenses are independent rows and
   * survive (the generated expense's sourceRecurringId is provenance only). */
  remove(userId: string, id: string): Promise<void>;
  /** Forecast rows for a FUTURE Jalali month; [] for current/past — the
   * current month has real generated expenses, a missed past month stays
   * empty (decision 15). */
  preview(userId: string, monthKey: string): Promise<RecurringForecastRow[]>;
}

function realDateOrThrow(iso: string): void {
  try {
    fromISODate(iso);
  } catch {
    throw new ValidationError(`not a real calendar date: ${iso}`);
  }
}

/** The template window must be real dates and must not end before it starts
 * — validated against the FINAL pair on update (existing fields merged). */
function assertTemplateWindow(startDate: string, endDate: string | null): void {
  realDateOrThrow(startDate);
  if (endDate !== null) {
    realDateOrThrow(endDate);
    if (endDate < startDate) {
      throw new ValidationError(
        `endDate ${endDate} is before startDate ${startDate}`,
      );
    }
  }
}

export function createRecurringService(db: DomainDb): RecurringService {
  async function getOwned(userId: string, id: string): Promise<RecurringTemplate> {
    parseOrThrow(uuidv7Schema, id, "template id");
    const [template] = await db
      .select()
      .from(recurringTemplates)
      .where(and(eq(recurringTemplates.id, id), eq(recurringTemplates.userId, userId)))
      .limit(1);
    if (!template) throw new NotFoundError(`recurring template ${id} not found`);
    return template;
  }

  return {
    async list(userId) {
      return db
        .select()
        .from(recurringTemplates)
        .where(eq(recurringTemplates.userId, userId))
        .orderBy(asc(recurringTemplates.createdAt), asc(recurringTemplates.id));
    },

    get(userId, id) {
      return getOwned(userId, id);
    },

    async create(userId, input) {
      const data = parseOrThrow(
        createTemplateInputSchema,
        input,
        "recurring template input",
      );
      await getOwnedCategory(db, userId, data.categoryId);
      assertTemplateWindow(data.startDate, data.endDate ?? null);

      const now = new Date();
      const [template] = await db
        .insert(recurringTemplates)
        .values({
          id: newId(),
          title: data.title,
          amountToman: data.amountToman,
          categoryId: data.categoryId,
          dayOfMonth: data.dayOfMonth,
          startDate: data.startDate,
          endDate: data.endDate ?? null,
          active: true,
          userId,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      await learnOnSave(db, userId, data.title, data.categoryId);
      return template!;
    },

    async update(userId, id, input) {
      const data = parseOrThrow(
        updateTemplateInputSchema,
        input,
        "recurring template input",
      );
      if (Object.keys(data).length === 0) {
        throw new ValidationError("empty recurring template update");
      }
      const existing = await getOwned(userId, id);
      if (data.categoryId !== undefined) {
        await getOwnedCategory(db, userId, data.categoryId);
      }

      const startDate = data.startDate ?? existing.startDate;
      const endDate =
        data.endDate !== undefined ? (data.endDate ?? null) : existing.endDate;
      assertTemplateWindow(startDate, endDate);

      const set: {
        title?: string;
        amountToman?: number;
        categoryId?: string;
        dayOfMonth?: number;
        startDate?: string;
        endDate?: string | null;
        active?: boolean;
        updatedAt: Date;
      } = { updatedAt: new Date() };
      if (data.title !== undefined) set.title = data.title;
      if (data.amountToman !== undefined) set.amountToman = data.amountToman;
      if (data.categoryId !== undefined) set.categoryId = data.categoryId;
      if (data.dayOfMonth !== undefined) set.dayOfMonth = data.dayOfMonth;
      if (data.startDate !== undefined) set.startDate = data.startDate;
      if (data.endDate !== undefined) set.endDate = data.endDate ?? null;
      if (data.active !== undefined) set.active = data.active;

      const [template] = await db
        .update(recurringTemplates)
        .set(set)
        .where(eq(recurringTemplates.id, id))
        .returning();

      const title = data.title ?? existing.title;
      const categoryId = data.categoryId ?? existing.categoryId;
      await learnOnSave(db, userId, title, categoryId);
      return template!;
    },

    async remove(userId, id) {
      await getOwned(userId, id);
      await db.delete(recurringTemplates).where(eq(recurringTemplates.id, id));
    },

    async preview(userId, monthKey) {
      parseOrThrow(jalaliMonthKeySchema, monthKey, "month key");
      if (monthPosition(monthKey, currentJalaliMonthKey()) !== "future") {
        return [];
      }

      const rows = await db
        .select()
        .from(recurringTemplates)
        .where(
          and(
            eq(recurringTemplates.userId, userId),
            eq(recurringTemplates.active, true),
          ),
        );

      return rows
        .filter((template) => isTemplateDueInMonth(template, monthKey))
        .map((template) => toForecastRow(template, monthKey))
        .sort((a, b) => a.day - b.day);
    },
  };
}

/** Lazy-on-request generation (decision 14): the first read that reaches the
 * current month's data calls this BEFORE reading. Returns how many expenses
 * were inserted. */
export async function ensureRecurringExpensesGenerated(
  db: DomainDb,
  userId: string,
  monthKey: string,
): Promise<{ generated: number }> {
  parseOrThrow(jalaliMonthKeySchema, monthKey, "month key");
  // Only the CURRENT Jalali month generates — a missed month stays empty
  // forever, the future belongs to preview.
  if (monthPosition(monthKey, currentJalaliMonthKey()) !== "current") {
    return { generated: 0 };
  }

  let generated = 0;
  try {
    const activeTemplates = await db
      .select()
      .from(recurringTemplates)
      .where(
        and(
          eq(recurringTemplates.userId, userId),
          eq(recurringTemplates.active, true),
        ),
      );
    const due = activeTemplates.filter((t) => isTemplateDueInMonth(t, monthKey));

    const existing = await db
      .select({ sourceRecurringId: expenses.sourceRecurringId })
      .from(expenses)
      .where(
        and(
          eq(expenses.userId, userId),
          eq(expenses.monthKey, monthKey),
          isNotNull(expenses.sourceRecurringId),
        ),
      );
    const alreadyGenerated = new Set(
      existing.map((row) => row.sourceRecurringId),
    );
    const missing = due.filter((t) => !alreadyGenerated.has(t.id));

    const now = new Date();
    for (const template of missing) {
      // ON CONFLICT DO NOTHING on the unique index: a concurrent request's
      // insert (or a retried one) is a no-op, never an error.
      const inserted = await db
        .insert(expenses)
        .values({
          id: newId(),
          amountToman: template.amountToman,
          title: template.title,
          note: null,
          categoryId: template.categoryId,
          occurredAt: occurrenceISO(monthKey, template.dayOfMonth),
          monthKey,
          sourceRecurringId: template.id,
          userId,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing({
          target: [expenses.userId, expenses.sourceRecurringId, expenses.monthKey],
        })
        .returning({ id: expenses.id });
      generated += inserted.length;
    }
  } catch (error) {
    // Reads never break because of generation (decision 14): log and serve
    // with the data that exists; the next request retries for free.
    console.error("[recurring] generation failed; serving without it", error);
    return { generated };
  }
  return { generated };
}
