"use client";

import { ExpenseRows } from "./expense-rows";
import type { Category, ExpenseWithCategory } from "@/lib/services";
import type { RecurringForecastRow } from "@/lib/recurring";

// The ledger (ticket 07 v2 / ticket 26): the month's notebook under the
// tiles, opened by the one heavy ink rule. The rows themselves live in
// expense-rows.tsx — ticket 28's category drilldown renders the same
// anatomy; an expense row opens the edit sheet, a forecast row walks to
// the templates page.

export function Ledger({
  monthKey,
  expenses,
  forecast,
  categories,
}: {
  monthKey: string;
  expenses: ExpenseWithCategory[];
  forecast: RecurringForecastRow[];
  categories: Category[];
}) {
  if (expenses.length === 0 && forecast.length === 0) return null;

  return (
    <section className="mt-6 border-t-2 border-ink" aria-label="خرج‌های ماه">
      <ExpenseRows
        monthKey={monthKey}
        expenses={expenses}
        forecast={forecast}
        categories={categories}
      />
    </section>
  );
}
