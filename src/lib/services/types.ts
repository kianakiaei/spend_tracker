import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type * as schema from "@/db/schema";

// Shared service types (ticket 22). The injection seam is the db: every
// service factory takes it as an argument — never the global `db` from
// @/db — so integration tests run against a temp libSQL file (ticket 12's
// testability rule; no `next/*` imports anywhere under services/).

export type DomainDb = LibSQLDatabase<typeof schema>;

export type Category = typeof schema.categories.$inferSelect;
export type Expense = typeof schema.expenses.$inferSelect;

/** A month-list row: the expense plus the category it points at (ticket 22:
 * "برگرداندن دستهٔ هر خرج"). */
export type ExpenseWithCategory = Expense & { category: Category };
