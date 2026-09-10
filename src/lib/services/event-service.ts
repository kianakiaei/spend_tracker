// Event service: رویداد — a named bucket (travel, wedding, …) collecting
// expenses by manual attach. An expense keeps its category AND its month —
// the event is a pure overlay. Deleting an event only unlinks expenses,
// never deletes them. No `next/*` imports — the db arrives injected.

import { and, asc, count, eq, sum } from "drizzle-orm";
import { z } from "zod";
import { categories, events, expenses } from "@/db/schema";
import { newId } from "@/lib/id";
import { dateOnlySchema, titleSchema, uuidv7Schema } from "@/lib/schemas";
import {
  DuplicateCategoryNameError,
  NotFoundError,
  ValidationError,
} from "./errors";
import { parseOrThrow } from "./parse";
import type { DomainDb, ExpenseWithCategory } from "./types";

export type EventRow = typeof events.$inferSelect;

function rangeRefine(
  data: { startDate?: string | null; endDate?: string | null },
  ctx: z.RefinementCtx,
): void {
  if (
    data.startDate != null &&
    data.endDate != null &&
    data.endDate < data.startDate
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "end date must not be before start date",
    });
  }
}

const createEventInputSchema = z
  .object({
    title: titleSchema,
    note: z.string().nullish(),
    startDate: dateOnlySchema.nullish(),
    endDate: dateOnlySchema.nullish(),
  })
  .superRefine(rangeRefine);

const updateEventInputSchema = z
  .object({
    title: titleSchema.optional(),
    note: z.string().nullish(),
    startDate: dateOnlySchema.nullish(),
    endDate: dateOnlySchema.nullish(),
  })
  .superRefine(rangeRefine);

export interface CreateEventInput {
  title: string;
  note?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

export interface UpdateEventInput {
  title?: string;
  note?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

export interface EventSummary {
  totalToman: number;
  count: number;
}

export interface EventService {
  list(userId: string): Promise<EventRow[]>;
  get(userId: string, id: string): Promise<EventRow>;
  create(userId: string, input: CreateEventInput): Promise<EventRow>;
  update(userId: string, id: string, input: UpdateEventInput): Promise<EventRow>;
  /** Deletes the event and unlinks its expenses (they keep category + month). */
  remove(userId: string, id: string): Promise<void>;
  /** Event totals overlay: recorded sum + count; month math is untouched. */
  summary(userId: string, id: string): Promise<EventSummary>;
  /** The event's expenses, newest first (dated desc, undated last). */
  listExpenses(userId: string, id: string): Promise<ExpenseWithCategory[]>;
}

export async function getOwnedEvent(
  db: DomainDb,
  userId: string,
  id: string,
): Promise<EventRow> {
  parseOrThrow(uuidv7Schema, id, "event id");
  const [event] = await db
    .select()
    .from(events)
    .where(and(eq(events.id, id), eq(events.userId, userId)))
    .limit(1);
  if (!event) throw new NotFoundError(`event ${id} not found`);
  return event;
}

export function createEventService(db: DomainDb): EventService {
  const getOwned = (userId: string, id: string) => getOwnedEvent(db, userId, id);

  async function assertTitleFree(
    userId: string,
    title: string,
    exceptId?: string,
  ): Promise<void> {
    const [row] = await db
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.userId, userId), eq(events.title, title)))
      .limit(1);
    if (row && row.id !== exceptId) {
      throw new DuplicateCategoryNameError(
        "an event with this title already exists",
      );
    }
  }

  return {
    async list(userId) {
      return db
        .select()
        .from(events)
        .where(eq(events.userId, userId))
        .orderBy(asc(events.createdAt), asc(events.id));
    },

    async get(userId, id) {
      return getOwned(userId, id);
    },

    async create(userId, input) {
      const data = parseOrThrow(createEventInputSchema, input, "event input");
      await assertTitleFree(userId, data.title);
      const now = new Date();
      const [event] = await db
        .insert(events)
        .values({
          id: newId(),
          title: data.title,
          note: data.note ?? null,
          startDate: data.startDate ?? null,
          endDate: data.endDate ?? null,
          userId,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return event!;
    },

    async update(userId, id, input) {
      const data = parseOrThrow(updateEventInputSchema, input, "event input");
      if (Object.keys(data).length === 0) {
        throw new ValidationError("empty event update");
      }
      const existing = await getOwned(userId, id);
      if (data.title !== undefined && data.title !== existing.title) {
        await assertTitleFree(userId, data.title, id);
      }
      const effectiveStart =
        data.startDate !== undefined ? data.startDate : existing.startDate;
      const effectiveEnd =
        data.endDate !== undefined ? data.endDate : existing.endDate;
      if (
        effectiveStart != null &&
        effectiveEnd != null &&
        effectiveEnd < effectiveStart
      ) {
        throw new ValidationError("end date must not be before start date");
      }
      const [event] = await db
        .update(events)
        .set({
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(data.note !== undefined ? { note: data.note } : {}),
          ...(data.startDate !== undefined
            ? { startDate: data.startDate }
            : {}),
          ...(data.endDate !== undefined ? { endDate: data.endDate } : {}),
          updatedAt: new Date(),
        })
        .where(eq(events.id, id))
        .returning();
      return event!;
    },

    async remove(userId, id) {
      await getOwned(userId, id);
      await db
        .update(expenses)
        .set({ eventId: null, updatedAt: new Date() })
        .where(and(eq(expenses.userId, userId), eq(expenses.eventId, id)));
      await db.delete(events).where(eq(events.id, id));
    },

    async summary(userId, id) {
      await getOwned(userId, id);
      const [row] = await db
        .select({
          totalToman: sum(expenses.amountToman),
          count: count(expenses.id),
        })
        .from(expenses)
        .where(and(eq(expenses.userId, userId), eq(expenses.eventId, id)));
      return {
        totalToman: Number(row?.totalToman ?? 0),
        count: row?.count ?? 0,
      };
    },

    async listExpenses(userId, id) {
      await getOwned(userId, id);
      const rows = await db
        .select({ expense: expenses, category: categories })
        .from(expenses)
        .innerJoin(categories, eq(categories.id, expenses.categoryId))
        .where(and(eq(expenses.userId, userId), eq(expenses.eventId, id)));
      return rows
        .map((row) => ({ ...row.expense, category: row.category }))
        .sort((a, b) => {
          if (a.occurredAt === null && b.occurredAt === null) {
            return (
              b.createdAt.getTime() - a.createdAt.getTime() ||
              (a.id < b.id ? -1 : 1)
            );
          }
          if (a.occurredAt === null) return 1;
          if (b.occurredAt === null) return -1;
          if (a.occurredAt !== b.occurredAt)
            return a.occurredAt < b.occurredAt ? 1 : -1;
          return (
            b.createdAt.getTime() - a.createdAt.getTime() ||
            (a.id < b.id ? -1 : 1)
          );
        });
    },
  };
}

