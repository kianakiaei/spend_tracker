import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { formatNumber } from "@/lib/format";
import {
  currentJalaliMonthKey,
  formatToman,
  fromJalaliMonthKey,
  jalaliMonthLabel,
} from "@/lib/jalali";
import { jalaliMonthKeySchema, uuidv7Schema } from "@/lib/schemas";
import {
  createCategoryService,
  createEventService,
  createExpenseService,
  createRecurringService,
  createSummaryService,
  getFallbackCategory,
  listLearnedKeys,
} from "@/lib/services";
import { AddExpenseFab, ExpenseSheetProvider } from "@/components/expense-sheet/provider";
import { Ledger } from "@/components/ledger";
import { MonthNav } from "@/components/month-nav";
import { SummaryTiles } from "@/components/summary-tiles";

// The read-only dashboard (ticket 26), rebuilt from the approved ticket-07
// v2 direction. An RSC reading the services DIRECTLY — never its own v1
// handlers (ticket 12). ?month= is a Jalali month key, unbounded in both
// directions; an absent key means the current month, an invalid one
// canonicalizes to /. The session guard is authoritative here (proxy only
// checks cookie presence — ticket 08).
//
// Ticket 27 adds the sheet seam: the RSC also loads the learned counters
// and the fallback category, and the provider turns them into the client
// engine that answers the form's live suggestion from memory.

const summaryService = createSummaryService(db);
const expenseService = createExpenseService(db);
const recurringService = createRecurringService(db);
const categoryService = createCategoryService(db);
const eventService = createEventService(db);

export default async function DashboardPage({
  searchParams,
}: PageProps<"/">) {
  const { month, expense: expenseParam } = await searchParams;
  const parsed = jalaliMonthKeySchema.safeParse(month);
  if (month !== undefined && !parsed.success) redirect("/");
  const monthKey = parsed.success ? parsed.data : currentJalaliMonthKey();

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const userId = session.user.id;
  // Six independent reads; ensure runs inside the second for the current
  // month (decision 14) — idempotent, so concurrent calls are harmless. The
  // last two feed the sheet's client-side suggestion engine (ticket 27).
  const [summary, expenses, forecast, categories, learnedKeys, fallback, allEvents] =
    await Promise.all([
      summaryService.getSummary(userId, monthKey),
      expenseService.listByMonth(userId, monthKey),
      recurringService.preview(userId, monthKey),
      categoryService.list(userId),
      listLearnedKeys(db, userId),
      getFallbackCategory(db, userId),
      eventService.list(userId),
    ]);
  // The ?expense= deep-link (ticket 28: the templates page's «خرج این ماه
  // تولید شد»): a valid id owned by this user opens its edit sheet; a stale
  // or foreign one is quietly just a ledger visit.
  let deepLinkedExpense = null;
  if (typeof expenseParam === "string" && uuidv7Schema.safeParse(expenseParam).success) {
    deepLinkedExpense = await expenseService
      .get(userId, expenseParam)
      .catch(() => null);
  }

  const label = jalaliMonthLabel(fromJalaliMonthKey(monthKey));

  return (
    <ExpenseSheetProvider
      monthKey={monthKey}
      categories={categories}
      events={allEvents}
      learnedKeys={learnedKeys}
      fallbackCategoryId={fallback.id}
      initialExpense={deepLinkedExpense ?? undefined}
    >
      <div className="mx-auto w-full max-w-[680px] px-6 pb-10 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <MonthNav monthKey={monthKey} label={label} />
          <nav className="flex gap-4 text-[13px] text-ink-muted">
            <Link href="/insights" className="hover:text-accent">
              بینش‌ها
            </Link>
            <Link href="/events" className="hover:text-accent">
              رویدادها
            </Link>
            <Link href="/categories" className="hover:text-accent">
              دسته‌ها
            </Link>
            <Link href="/templates" className="hover:text-accent">
              الگوها
            </Link>
          </nav>
        </div>

        {summary.byCategory.length === 0 ? (
          <p className="py-16 text-center text-[14.5px] leading-8 text-ink-muted">
            {monthKey === currentJalaliMonthKey()
              ? "این ماه هنوز خرجی ندارد."
              : `برای ${label} خرجی ثبت نشده.`}
          </p>
        ) : (
          <>
            <h1 className="mt-3 text-[48px] font-extrabold leading-[1.45] tracking-[-0.01em]">
              <span className="tabular-nums">{formatNumber(summary.totalToman)}</span>
              <small className="ms-2 text-[14.5px] font-medium text-ink-muted">
                تومان
              </small>
            </h1>
            {summary.forecastToman !== undefined && (
              <p className="mt-1 text-[13px] text-ink-muted">
                شامل پیش‌بینی الگوها: {formatToman(summary.forecastToman)}
              </p>
            )}
            <SummaryTiles
              monthKey={monthKey}
              summary={summary}
              categories={categories}
            />
            <Ledger
              monthKey={monthKey}
              expenses={expenses}
              forecast={forecast}
              categories={categories}
            />
          </>
        )}
      </div>
      <AddExpenseFab />
    </ExpenseSheetProvider>
  );
}
