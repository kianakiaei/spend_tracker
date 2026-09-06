import Link from "next/link";
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
// day, recorded before forecast on a tie (stable sort). Expense rows are
// read-only HERE: the edit sheet is ticket 27; a forecast row opens the
// templates page (built with ticket 28).

const FALLBACK_COLOR = "#82887e";

const TAG_CLASS =
  "shrink-0 rounded-full bg-accent-soft px-2 py-px text-[10px] font-medium text-accent";

const DAY_CLASS = "w-[66px] shrink-0 text-[11.5px] text-ink-muted";
const AMOUNT_CLASS =
  "whitespace-nowrap text-[13.5px] font-bold tabular-nums";

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
          <li
            key={expense.id}
            className="flex items-center gap-2.5 border-b border-rule px-0.5 py-2.5"
          >
            <span className={DAY_CLASS}>—</span>
            <RowTitle
              title={expense.title}
              color={expense.category.color}
              tag={expense.sourceRecurringId !== null ? "از الگو" : null}
            />
            <span className={AMOUNT_CLASS}>{formatNumber(expense.amountToman)}</span>
          </li>
        ))}
        {[...dated, ...forecastEntries]
          .sort((a, b) => a.day - b.day)
          .map((entry) =>
            entry.kind === "expense" ? (
              <li
                key={entry.expense.id}
                className="flex items-center gap-2.5 border-b border-rule px-0.5 py-2.5"
              >
                <span className={DAY_CLASS}>
                  {formatJalali(fromISODate(entry.expense.occurredAt), "d MMMM")}
                </span>
                <RowTitle
                  title={entry.expense.title}
                  color={entry.expense.category.color}
                  tag={entry.expense.sourceRecurringId !== null ? "از الگو" : null}
                />
                <span className={AMOUNT_CLASS}>
                  {formatNumber(entry.expense.amountToman)}
                </span>
              </li>
            ) : (
              <li key={entry.forecast.templateId} className="border-b border-rule">
                <Link
                  href="/templates"
                  className="flex items-center gap-2.5 px-0.5 py-2.5 hover:bg-accent-soft"
                >
                  <span className={DAY_CLASS}>
                    {toPersianDigits(entry.forecast.day)} {monthName}
                  </span>
                  <RowTitle
                    title={entry.forecast.title}
                    color={colorOf.get(entry.forecast.categoryId) ?? null}
                    tag="پیش‌بینی"
                  />
                  <span className={AMOUNT_CLASS}>
                    {formatNumber(entry.forecast.amountToman)}
                  </span>
                </Link>
              </li>
            ),
          )}
      </ul>
    </section>
  );
}

/** Day cell, dot + title + optional tag, amount — the shared row anatomy
 * (ticket 26: «روز، عنوان + نقطهٔ دسته، از الگو، مبلغ»). */
function RowTitle({
  title,
  color,
  tag,
}: {
  title: string;
  color: string | null;
  tag: string | null;
}) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2 text-[13.5px] font-semibold">
      <i
        className="size-[9px] shrink-0 rounded-full"
        style={{ backgroundColor: color ?? FALLBACK_COLOR }}
        aria-hidden
      />
      <span className="truncate">{title}</span>
      {tag && <span className={TAG_CLASS}>{tag}</span>}
    </span>
  );
}
