import { and, asc, count, desc, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { categories, events, expenses } from "@/db/schema";
import { canonical } from "@/lib/categorization/normalize";
import { newId } from "@/lib/id";
import { currentJalaliMonthKey, fromISODate, jalaliMonthKey } from "@/lib/jalali";
import { monthPosition } from "@/lib/recurring";
import {
  amountTomanSchema,
  dateOnlySchema,
  expenseNoteSchema,
  jalaliMonthKeySchema,
  quantitySchema,
  refineUnitQuantity,
  titleSchema,
  unitSchema,
  uuidv7Schema,
  type ExpenseUnit,
} from "@/lib/schemas";
import { getOwnedCategory } from "./category-service";
import { NotFoundError, ValidationError } from "./errors";
import { learnOnSave } from "./learning";
import { parseOrThrow } from "./parse";
import { ensureRecurringExpensesGenerated } from "./recurring-service";
import type {
  DomainDb,
  Expense,
  ExpenseWithCategory,
  ExpenseWithEventTitle,
} from "./types";

// Expense service (ticket 22): create/update/delete are free — past and
// future dates are allowed. Every expense has an occurrence date;
// monthKey is always derived from occurredAt via the jalali module.
// Every save (create/update) fires the learning pipeline with the final
// category.

/** The search page's cap — one screen, the query stays cheap on big ledgers. */
const SEARCH_LIMIT = 100;

/** One row of the whole-ledger search (تیکت جست‌وجو): everything the
 * «جست‌وجو در همه ماه‌ها» page needs to render a hit. */
export interface SearchResult {
  expenseId: string;
  title: string;
  note: string | null;
  amountToman: number;
  quantity: number;
  unit: ExpenseUnit;
  monthKey: string;
  occurredAt: string;
  /** Null on event-only expenses — they live in an event, not a category. */
  categoryName: string | null;
  categoryId: string | null;
  /** The رویداد the expense belongs to — null when unattached. */
  eventTitle: string | null;
  eventId: string | null;
  sourceRecurringId: string | null;
}

function toSearchResult(row: {
  expense: Expense;
  category: { id: string; name: string } | null;
  event: { title: string } | null;
}): SearchResult {
  return {
    expenseId: row.expense.id,
    title: row.expense.title,
    note: row.expense.note,
    amountToman: row.expense.amountToman,
    quantity: row.expense.quantity,
    unit: row.expense.unit,
    monthKey: row.expense.monthKey,
    occurredAt: row.expense.occurredAt,
    categoryName: row.category?.name ?? null,
    categoryId: row.category?.id ?? null,
    eventTitle: row.event?.title ?? null,
    eventId: row.expense.eventId,
    sourceRecurringId: row.expense.sourceRecurringId,
  };
}

/** An expense needs a home: a category, an event, or both. Category-less
 * rows are event-only — they never enter month/category totals. */
function refineCategoryOrEvent(
  data: { categoryId?: string | null; eventId?: string | null },
  ctx: z.RefinementCtx,
): void {
  if (data.categoryId == null && data.eventId == null) {
    ctx.addIssue({
      code: "custom",
      path: ["categoryId"],
      message: "an expense needs a category or an event",
    });
  }
}

const createExpenseInputSchema = z
  .object({
    amountToman: amountTomanSchema,
    quantity: quantitySchema.optional(),
    unit: unitSchema.optional(),
    title: titleSchema,
    note: expenseNoteSchema.nullish(),
    categoryId: uuidv7Schema.nullish(),
    occurredAt: dateOnlySchema,
    eventId: uuidv7Schema.nullish(),
  })
  .superRefine(refineUnitQuantity)
  .superRefine(refineCategoryOrEvent);

const updateExpenseInputSchema = z
  .object({
    amountToman: amountTomanSchema.optional(),
    quantity: quantitySchema.optional(),
    unit: unitSchema.optional(),
    title: titleSchema.optional(),
    note: expenseNoteSchema.nullish(),
    categoryId: uuidv7Schema.nullish(),
    occurredAt: dateOnlySchema.optional(),
    eventId: uuidv7Schema.nullish(),
  })
  .superRefine(refineUnitQuantity);

/** Blank notes store as NULL — «بدون یادداشت» stays blank, not "". The
 * input schema already trims, so whitespace-only arrives as "". */
function normalizeNote(note: string | null | undefined): string | null {
  if (note == null || note === "") return null;
  return note;
}

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
  quantity?: number;
  unit?: ExpenseUnit;
  title: string;
  note?: string | null;
  /** Null = event-only (requires eventId). */
  categoryId?: string | null;
  occurredAt: string;
  eventId?: string | null;
}

export interface UpdateExpenseInput {
  amountToman?: number;
  quantity?: number;
  unit?: ExpenseUnit;
  title?: string;
  note?: string | null;
  /** Null detaches the category — only with an (effective) event. */
  categoryId?: string | null;
  occurredAt?: string;
  eventId?: string | null;
}

export interface ExpenseService {
  /** One expense with its category — the v1 API's GET [id] (ticket 25). */
  get(userId: string, id: string): Promise<ExpenseWithCategory>;
  /**
   * monthKey is always derived from occurredAt. Fires learning with the
   * final category.
   */
  create(
    userId: string,
    input: CreateExpenseInput,
    /** Ignored; kept so existing callers that passed the form month still typecheck. */
    _entryMonthKey?: string,
  ): Promise<Expense>;
  /**
   * Changing the date re-derives monthKey from the new date. Fires
   * learning with the final title/category.
   */
  update(userId: string, id: string, input: UpdateExpenseInput): Promise<Expense>;
  /** Free delete; learning is never rolled back (ticket 06). */
  remove(userId: string, id: string): Promise<void>;
  /** A month's ledger, chronological by occurrence date, insertion order
   * as the tie-break. */
  listByMonth(userId: string, monthKey: string): Promise<ExpenseWithEventTitle[]>;
  /** All-time expense count per category (the categories page's delete
   * guard, ticket 28): missing key = zero. Aggregation lives in SQL. */
  countByCategory(userId: string): Promise<Record<string, number>>;
  countByCategory(userId: string): Promise<Record<string, number>>;
  /** Whole-ledger search (تیکت جست‌وجو): every expense whose title contains
   * the query in canonical Persian form, newest first. */
  searchByTitle(userId: string, query: string): Promise<SearchResult[]>;
  /** The newest SEARCH_LIMIT rows of the whole ledger — the search page's
   * initial render (the client board narrows live as the user types). */
  listAll(userId: string): Promise<SearchResult[]>;
}


export function createExpenseService(db: DomainDb): ExpenseService {
  /** null/undefined = no event; otherwise the event must exist + belong here. */
  async function resolveEventId(
    userId: string,
    eventId: string | null | undefined,
  ): Promise<string | null> {
    if (eventId === undefined || eventId === null) return null;
    parseOrThrow(uuidv7Schema, eventId, "event id");
    const [row] = await db
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.id, eventId), eq(events.userId, userId)))
      .limit(1);
    if (!row) throw new NotFoundError(`event ${eventId} not found`);
    return row.id;
  }

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
    async get(userId, id) {
      parseOrThrow(uuidv7Schema, id, "expense id");
      const [row] = await db
        .select({ expense: expenses, category: categories })
        .from(expenses)
        .leftJoin(categories, eq(categories.id, expenses.categoryId))
        .where(and(eq(expenses.id, id), eq(expenses.userId, userId)))
        .limit(1);
      if (!row) throw new NotFoundError(`expense ${id} not found`);
      return { ...row.expense, category: row.category };
    },

    async create(userId, input) {
      const data = parseOrThrow(createExpenseInputSchema, input, "expense input");
      if (data.categoryId != null) {
        await getOwnedCategory(db, userId, data.categoryId);
      }
      const eventId = await resolveEventId(userId, data.eventId);

      const now = new Date();
      const [expense] = await db
        .insert(expenses)
        .values({
          id: newId(),
          amountToman: data.amountToman,
          quantity: data.quantity ?? 1,
          unit: data.unit ?? "piece",
          title: data.title,
          note: normalizeNote(data.note),
          categoryId: data.categoryId ?? null,
          occurredAt: data.occurredAt,
          monthKey: monthKeyOf(data.occurredAt),
          sourceRecurringId: null,
          eventId,
          userId,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      // Event-only expenses teach nothing — there is no category to learn.
      if (data.categoryId != null) {
        await learnOnSave(db, userId, data.title, data.categoryId);
      }
      return expense!;
    },

    async update(userId, id, input) {
      const data = parseOrThrow(updateExpenseInputSchema, input, "expense input");
      if (Object.keys(data).length === 0) {
        throw new ValidationError("empty expense update");
      }
      const existing = await getOwned(userId, id);
      if (data.categoryId !== undefined && data.categoryId !== null) {
        await getOwnedCategory(db, userId, data.categoryId);
      }
      const eventId =
        data.eventId !== undefined ? await resolveEventId(userId, data.eventId) : undefined;
      // Effective home after this patch — detaching the last one strands
      // the expense (neither category nor event).
      const effectiveCategoryId =
        data.categoryId !== undefined ? data.categoryId : existing.categoryId;
      const effectiveEventId = eventId !== undefined ? eventId : existing.eventId;
      if (effectiveCategoryId == null && effectiveEventId == null) {
        throw new ValidationError("an expense needs a category or an event");
      }
      // The input schema guards the incoming pair; the stored row supplies
      // the other half when only one side changes (fractional kilos must
      // not become fractional pieces through a unit-only edit).
      const effectiveUnit = data.unit ?? existing.unit;
      const effectiveQuantity = data.quantity ?? existing.quantity;
      if (effectiveUnit === "piece" && !Number.isInteger(effectiveQuantity)) {
        throw new ValidationError("piece quantity must be an integer");
      }

      const occurredAt = data.occurredAt ?? existing.occurredAt;
      const monthKey = monthKeyOf(occurredAt);

      const set: {
        amountToman?: number;
        quantity?: number;
        unit?: ExpenseUnit;
        title?: string;
        note?: string | null;
        categoryId?: string | null;
        eventId?: string | null;
        updatedAt: Date;
      } = { updatedAt: new Date() };
      if (data.amountToman !== undefined) set.amountToman = data.amountToman;
      if (data.quantity !== undefined) set.quantity = data.quantity;
      if (data.unit !== undefined) set.unit = data.unit;
      if (data.title !== undefined) set.title = data.title;
      if (data.note !== undefined) set.note = normalizeNote(data.note);
      if (data.categoryId !== undefined) set.categoryId = data.categoryId;
      if (eventId !== undefined) set.eventId = eventId;

      const [expense] = await db
        .update(expenses)
        .set({ ...set, occurredAt, monthKey })
        .where(eq(expenses.id, id))
        .returning();

      const title = data.title ?? existing.title;
      const categoryId =
        data.categoryId !== undefined ? data.categoryId : existing.categoryId;
      if (categoryId != null) {
        await learnOnSave(db, userId, title, categoryId);
      }
      return expense!;
    },

    async remove(userId, id) {
      await getOwned(userId, id);
      await db.delete(expenses).where(eq(expenses.id, id));
    },

    async listByMonth(userId, monthKey) {
      parseOrThrow(jalaliMonthKeySchema, monthKey, "month key");

      // Decision 14's second wiring: the first request reaching the CURRENT
      // month's ledger generates due templates before reading. Past months
      // never generate on read (they fill on template writes); the future
      // belongs to preview.
      // Recording a fresh expense is deliberately NOT a call-site.
      if (monthPosition(monthKey, currentJalaliMonthKey()) === "current") {
        await ensureRecurringExpensesGenerated(db, userId, monthKey);
      }

      // The month's full ledger, event-only rows included (category NULL):
      // month/category SPENDING totals ignore them (summary-service), and
      // the month views hide them (they live in their event alone) — but
      // event details and search still reach them through this read.
      const rows = await db
        .select({ expense: expenses, category: categories, event: events })
        .from(expenses)
        .leftJoin(categories, eq(categories.id, expenses.categoryId))
        .leftJoin(events, eq(events.id, expenses.eventId))
        .where(and(eq(expenses.userId, userId), eq(expenses.monthKey, monthKey)))
        .orderBy(asc(expenses.occurredAt), asc(expenses.createdAt), asc(expenses.id));

      return rows.map((row) => ({
        ...row.expense,
        category: row.category,
        eventTitle: row.event?.title ?? null,
      }));
    },

    async countByCategory(userId) {
      const rows = await db
        .select({
          categoryId: expenses.categoryId,
          count: count(expenses.id),
        })
        .from(expenses)
        .where(and(eq(expenses.userId, userId), isNotNull(expenses.categoryId)))
        .groupBy(expenses.categoryId);
      return Object.fromEntries(
        rows.flatMap((row) =>
          row.categoryId == null ? [] : [[row.categoryId, row.count] as const],
        ),
      );
    },

    async listAll(userId) {
      // The whole ledger, newest first (search page's initial render and the
      // mobile search's q="" case). One screen's worth is returned — same cap
      // as a search.
      const rows = await db
        .select({ expense: expenses, category: categories, event: events })
        .from(expenses)
        .leftJoin(categories, eq(categories.id, expenses.categoryId))
        .leftJoin(events, eq(events.id, expenses.eventId))
        .where(eq(expenses.userId, userId))
        .orderBy(
          desc(expenses.monthKey),
          desc(expenses.createdAt),
          desc(expenses.id),
        )
        .limit(SEARCH_LIMIT);
      return rows.map(toSearchResult);
    },

    async searchByTitle(userId, query) {
      // The query and every title pass through the SAME canonical form the
      // categorization engine uses — «شير» matches «شیر», Persian digits
      // match Latin ones, diacritics/ZWNJ vanish. A blank query is the empty
      // result: an empty search box lists nothing over the API.
      const needle = canonical(query);
      if (needle === "") return [];

      const all = await this.listAll(userId);
      return all
        .filter((hit) => canonical(hit.title).includes(needle))
        .slice(0, SEARCH_LIMIT);
    },
  };
}
