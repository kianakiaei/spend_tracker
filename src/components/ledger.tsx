"use client";

import Link from "next/link";
import { CategoryDot } from "./category-color";
import { useExpenseSheet } from "./expense-sheet/provider";
import { Tag } from "./tag";
import { formatNumber } from "@/lib/format";
import {
  formatJalali,
  fromISODate,
  fromJalaliMonthKey,
  jalaliDayOfMonth,
  toPersianDigits,
} from "@/lib/jalali";
import type { Category, ExpenseWithCategory } from "@/lib/services";
import type { RecurringForecastRow } from "@/lib/recurring";

// The ledger (ticket 07 v2 / ticket 26): the month's notebook under the
// tiles, opened by the one heavy ink rule. Undated expenses sit on top (the
// service orders them there; the «بدون تاریخ» chip marks the block), then
// dated rows and — in a future month — forecast rows interleave by Jalali
// day, recorded before forecast on a tie (stable sort). Ascending order is
// the resolved ticket-22 service contract, deliberately kept over the
// prototype's newest-first throwaway sort.
//
// Ticket 27: the ledger is a client island inside the sheet provider — an
// expense row opens the edit sheet, a forecast row still navigates to the
// templates page (built with ticket 28).

const LI_CLASS = "border-b border-rule";
const ROW_CLASS = "flex items-center gap-2.5 px-0.5 py-2.5";
const ROW_BUTTON_CLASS = `${ROW_CLASS} w-full rounded-lg text-start hover:bg-accent-soft`;
const DAY_CLASS = "w-[66px] shrink-0 text-[11.5px] text-ink-muted";
const AMOUNT_CLASS = "whitespace-nowrap text-[13.5px] font-bold tabular-nums";

/** Chronological entries: dated recorded rows and forecast rows on the same
 * Jalali day scale. */
type LedgerEntry =
  | { kind: "expense"; day: number; expense: ExpenseWithCategory & { occurredAt: string } }
  | { kind: "forecast"; day: number; forecast: RecurringForecastRow };

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
  const { openEdit } = useExpenseSheet();

  if (expenses.length === 0 && forecast.length === 0) return null;

  const colorOf = new Map(categories.map((c) => [c.id, c.color]));
  const monthName = formatJalali(fromJalaliMonthKey(monthKey), "MMMM");
  const undated = expenses.filter((e) => e.occurredAt === null);
  const dated: LedgerEntry[] = expenses
    .filter((e): e is ExpenseWithCategory & { occurredAt: string } => e.occurredAt !== null)
    .map((expense) => ({
      kind: "expense" as const,
      day: jalaliDayOfMonth(fromISODate(expense.occurredAt)),
      expense,
    }));
  const forecastEntries: LedgerEntry[] = forecast.map((row) => ({
    kind: "forecast" as const,
    day: row.day,
    forecast: row,
  }));

  return (
    <section className="mt-6 border-t-2 border-ink" aria-label="خرج‌های ماه">
      {undated.length > 0 && (
        <p className="mt-3">
          <span className="inline-flex items-center rounded-full border border-rule bg-panel px-3 py-1 text-[13px]">
            بدون تاریخ
          </span>
        </p>
      )}
      <ul>
        {undated.map((expense) => (
          <li key={expense.id} className={LI_CLASS}>
            <button
              type="button"
              onClick={() => openEdit(expense)}
              className={ROW_BUTTON_CLASS}
            >
              <Row
                day="—"
                title={expense.title}
                color={expense.category.color}
                tag={expense.sourceRecurringId !== null ? "از الگو" : null}
                amountToman={expense.amountToman}
              />
            </button>
          </li>
        ))}
        {[...dated, ...forecastEntries]
          .sort((a, b) => a.day - b.day)
          .map((entry) =>
            entry.kind === "expense" ? (
              <li key={entry.expense.id} className={LI_CLASS}>
                <button
                  type="button"
                  onClick={() => openEdit(entry.expense)}
                  className={ROW_BUTTON_CLASS}
                >
                  <Row
                    day={formatJalali(fromISODate(entry.expense.occurredAt), "d MMMM")}
                    title={entry.expense.title}
                    color={entry.expense.category.color}
                    tag={entry.expense.sourceRecurringId !== null ? "از الگو" : null}
                    amountToman={entry.expense.amountToman}
                  />
                </button>
              </li>
            ) : (
              <li key={entry.forecast.templateId} className={LI_CLASS}>
                <Link href="/templates" className={`${ROW_CLASS} rounded-lg hover:bg-accent-soft`}>
                  <Row
                    day={`${toPersianDigits(entry.forecast.day)} ${monthName}`}
                    title={entry.forecast.title}
                    color={colorOf.get(entry.forecast.categoryId) ?? null}
                    tag="پیش‌بینی"
                    amountToman={entry.forecast.amountToman}
                  />
                </Link>
              </li>
            ),
          )}
      </ul>
    </section>
  );
}

/** One shared row anatomy (ticket 26: «روز، عنوان + نقطهٔ دسته، از الگو،
 * مبلغ») — undated, dated and forecast rows all render through it. */
function Row({
  day,
  title,
  color,
  tag,
  amountToman,
}: {
  day: string;
  title: string;
  color: string | null;
  tag: string | null;
  amountToman: number;
}) {
  return (
    <>
      <span className={DAY_CLASS}>{day}</span>
      <span className="flex min-w-0 flex-1 items-center gap-2 text-[13.5px] font-semibold">
        <CategoryDot color={color} />
        <span className="truncate">{title}</span>
        {tag && <Tag>{tag}</Tag>}
      </span>
      <span className={AMOUNT_CLASS}>{formatNumber(amountToman)}</span>
    </>
  );
}
