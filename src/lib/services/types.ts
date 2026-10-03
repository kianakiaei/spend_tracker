import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type * as schema from "@/db/schema";

// Shared service types (ticket 22). The injection seam is the db: every
// service factory takes it as an argument — never the global `db` from
// @/db — so integration tests run against a temp libSQL file (ticket 12's
// testability rule; no `next/*` imports anywhere under services/).

export type DomainDb = LibSQLDatabase<typeof schema>;

export type Category = typeof schema.categories.$inferSelect;
export type Expense = typeof schema.expenses.$inferSelect;
export type RecurringTemplate = typeof schema.recurringTemplates.$inferSelect;

/** A month-list row: the expense plus the category it points at (ticket 22:
 * "برگرداندن دستهٔ هر خرج"). Event-only expenses have no category — the
 * row carries `category: null` and lives in its event instead. */
export type ExpenseWithCategory = Expense & { category: Category | null };

/** The same row with the title of the event the expense belongs to — null
 * when the expense is not attached to any event (the رویداد badge). */
export type ExpenseWithEventTitle = ExpenseWithCategory & {
  eventTitle: string | null;
};
