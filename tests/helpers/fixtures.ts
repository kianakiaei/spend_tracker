import { and, eq, isNotNull } from "drizzle-orm";
import { categories, expenses } from "@/db/schema";
import {
  addJalaliMonths,
  currentJalaliMonthKey,
  fromJalaliMonthKey,
  jalaliMonthKey,
} from "@/lib/jalali";
import type { Category, DomainDb } from "@/lib/services/types";

// Shared integration-test fixtures (tickets 23–24). The services own the
// clock, so tests derive past/current/future month keys from the real
// Tehran "now" instead of hardcoding any month — nothing ages.

export function relativeMonthKeys() {
  const current = currentJalaliMonthKey();
  const monthShift = (key: string, n: number) =>
    jalaliMonthKey(addJalaliMonths(fromJalaliMonthKey(key), n));
  return {
    CURRENT: current,
    PREV: monthShift(current, -1),
    NEXT: monthShift(current, 1),
    monthShift,
  };
}

/** The user's category row for a system slug (groceries, installment, …) —
 * the code↔category bridge (ticket 13). */
export async function systemCategoryBySlug(
  db: DomainDb,
  userId: string,
  slug: string,
): Promise<Category> {
  const [category] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.slug, slug)))
    .limit(1);
  if (!category) throw new Error(`system category ${slug} missing`);
  return category;
}

/** The month's generated expenses (sourceRecurringId set) — the observable
 * of lazy generation (decision 14). */
export const generatedExpenses = (
  db: DomainDb,
  userId: string,
  monthKey: string,
) =>
  db
    .select()
    .from(expenses)
    .where(
      and(
        eq(expenses.userId, userId),
        eq(expenses.monthKey, monthKey),
        isNotNull(expenses.sourceRecurringId),
      ),
    );
