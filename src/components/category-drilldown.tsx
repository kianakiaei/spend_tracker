"use client";

import { ExpenseRows } from "./expense-rows";
import { useExpenseSheet } from "./expense-sheet/provider";
import { jalaliMonthLabel, fromJalaliMonthKey } from "@/lib/jalali";
import type { Category, ExpenseWithEventTitle } from "@/lib/services";
import type { RecurringForecastRow } from "@/lib/recurring";

// The drilldown's interactive half (ticket 28): the «افزودن به این دسته»
// row opens the sheet with the category LOCKED (the ticket-27 handoff),
// and below it the same ledger anatomy the dashboard uses — an expense
// row opens the edit sheet, a forecast row walks to the templates page.
// A row attached to a رویداد wears its name as a badge.

export function CategoryDrilldownPanel({
  monthKey,
  category,
  expenses,
  forecast,
  categories,
  eventId,
}: {
  monthKey: string;
  category: Category;
  expenses: ExpenseWithEventTitle[];
  forecast: RecurringForecastRow[];
  categories: Category[];
  eventId?: string;
}) {
  const { openCreate } = useExpenseSheet();
  const empty = expenses.length === 0 && forecast.length === 0;

  return (
    <>
      <button
        type="button"
        onClick={() =>
          openCreate(
            eventId === undefined
              ? { categoryId: category.id }
              : { categoryId: category.id, eventId },
          )
        }
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-rule-strong bg-panel px-4 py-3 text-[14px] font-semibold text-accent hover:border-accent"
      >
        + افزودن به این دسته
      </button>

      {empty ? (
        <p className="mt-10 text-center text-[14.5px] leading-8 text-ink-muted">
          {category.name} در {jalaliMonthLabel(fromJalaliMonthKey(monthKey))}{" "}
          خرجی ندارد.
        </p>
      ) : (
        <section
          className="mt-6 border-t-2 border-ink"
          aria-label={`خرج‌های ${category.name}`}
        >
          <ExpenseRows
            monthKey={monthKey}
            expenses={expenses}
            forecast={forecast}
            categories={categories}
          />
        </section>
      )}
    </>
  );
}
