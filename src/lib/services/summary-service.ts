import { and, asc, count, eq, sum } from "drizzle-orm";
import { categories, expenses } from "@/db/schema";
import { currentJalaliMonthKey } from "@/lib/jalali";
import { monthPosition } from "@/lib/recurring";
import { jalaliMonthKeySchema } from "@/lib/schemas";
import {
  ensureRecurringExpensesGenerated,
  listActiveDueTemplates,
} from "./recurring-service";
import { parseOrThrow } from "./parse";
import type { DomainDb } from "./types";

// Summary service (ticket 24): the ticket-12 GET /api/v1/summaries shape,
// one shared read for the RSC dashboard and the v1 handler. Decision 14
// makes this the FIRST ensure call-site — but only the current month
// generates: past months never ensure and never forecast (a missed month
// stays empty), future months never generate (they belong to preview) —
// their totals composite the active due templates behind the ticket-23
// predicate, exposed additively as `forecastToman`. Aggregation lives in
// SQL (GROUP BY categoryId); the month's expense rows never reach memory.

/** One dashboard tile: a category's share of the month. `count` is the
 * number of RECORDED expenses — forecast rows contribute to totals only
 * (they are not expenses; the recurring-templates preview lists them). */
export interface SummaryCategoryRow {
  categoryId: string;
  name: string;
  totalToman: number;
  count: number;
}

export interface MonthSummary {
  monthKey: string;
  /** Current/past: the recorded total. Future: recorded + forecast. */
  totalToman: number;
  byCategory: SummaryCategoryRow[];
  /** Future months only — the templates-only sum, present even when zero.
   * The «شامل پیش‌بینی» subtitle is a UI decision, not this service's. */
  forecastToman?: number;
}

export interface SummaryService {
  getSummary(userId: string, monthKey: string): Promise<MonthSummary>;
}

export function createSummaryService(db: DomainDb): SummaryService {
  return {
    async getSummary(userId, monthKey) {
      parseOrThrow(jalaliMonthKeySchema, monthKey, "month key");
      const position = monthPosition(monthKey, currentJalaliMonthKey());

      // Decision 14's first wiring: the current month's first read generates
      // due templates BEFORE reading. ensure swallows its own failures —
      // the read never breaks because of generation.
      if (position === "current") {
        await ensureRecurringExpensesGenerated(db, userId, monthKey);
      }

      // The month's aggregation in SQL: one row per category. SQLite's SUM
      // arrives as a string — the amounts are integers, Number() is exact.
      const recordedRows = await db
        .select({
          categoryId: expenses.categoryId,
          totalToman: sum(expenses.amountToman),
          count: count(expenses.id),
        })
        .from(expenses)
        .where(and(eq(expenses.userId, userId), eq(expenses.monthKey, monthKey)))
        .groupBy(expenses.categoryId);

      const totals = new Map<string, { totalToman: number; count: number }>();
      let recordedTotal = 0;
      for (const row of recordedRows) {
        const totalToman = Number(row.totalToman ?? 0);
        totals.set(row.categoryId, { totalToman, count: row.count });
        recordedTotal += totalToman;
      }

      let forecastToman: number | undefined;
      if (position === "future") {
        const due = await listActiveDueTemplates(db, userId, monthKey);
        forecastToman = due.reduce((total, t) => total + t.amountToman, 0);
        // each forecast row lands on its own template's category (decision 15)
        for (const template of due) {
          const entry = totals.get(template.categoryId);
          if (entry) {
            entry.totalToman += template.amountToman;
          } else {
            totals.set(template.categoryId, {
              totalToman: template.amountToman,
              count: 0,
            });
          }
        }
      }

      // Categories in one read — tile names come from here and the order is
      // the dashboard order (categoryService.list's); categories with no
      // money this month drop out.
      const userCategories = await db
        .select()
        .from(categories)
        .where(eq(categories.userId, userId))
        .orderBy(asc(categories.order), asc(categories.createdAt));

      const summary: MonthSummary = {
        monthKey,
        totalToman: recordedTotal + (forecastToman ?? 0),
        byCategory: userCategories.flatMap((category) => {
          const entry = totals.get(category.id);
          return entry
            ? [
                {
                  categoryId: category.id,
                  name: category.name,
                  totalToman: entry.totalToman,
                  count: entry.count,
                },
              ]
            : [];
        }),
      };
      if (forecastToman !== undefined) summary.forecastToman = forecastToman;
      return summary;
    },
  };
}
