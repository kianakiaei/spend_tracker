import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { CategoryDot, tintOf } from "@/components/category-color";
import { CategoryDrilldownPanel } from "@/components/category-drilldown";
import { ExpenseSheetProvider } from "@/components/expense-sheet/provider";
import { formatNumber } from "@/lib/format";
import {
  currentJalaliMonthKey,
  fromJalaliMonthKey,
  jalaliMonthLabel,
} from "@/lib/jalali";
import { monthPosition } from "@/lib/recurring";
import { jalaliMonthKeySchema } from "@/lib/schemas";
import {
  createCategoryService,
  createEventService,
  createExpenseService,
  createRecurringService,
  createSummaryService,
  getFallbackCategory,
  listLearnedKeys,
} from "@/lib/services";

// The full-screen category drilldown (ticket 28): a tile's destination. An
// RSC reading the services DIRECTLY (never its own v1 handlers, ticket 12),
// guarded like the dashboard. The washed tint is the category's own color
// (ticket 07), so the page reads as the tile it came from. In a future
// month the total composites recorded + forecast and the forecast rows
// carry the «پیش‌بینی» badge (decision 15).

const categoryService = createCategoryService(db);
const expenseService = createExpenseService(db);
const recurringService = createRecurringService(db);
const summaryService = createSummaryService(db);
const eventService = createEventService(db);

export default async function CategoryDrilldownPage({
  params,
  searchParams,
}: PageProps<"/categories/[id]">) {
  const { id } = await params;
  const { month } = await searchParams;
  const parsed = jalaliMonthKeySchema.safeParse(month);
  if (month !== undefined && !parsed.success) redirect(`/categories/${id}`);
  const monthKey = parsed.success ? parsed.data : currentJalaliMonthKey();

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const userId = session.user.id;

  const category = await categoryService
    .get(userId, id)
    .catch(() => notFound());

  // The summary/expense reads ensure the current month's generation
  // (decision 14); the learned counters feed the sheet's engine (27).
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

  const mine = expenses.filter((e) => e.categoryId === category.id);
  const myForecast = forecast.filter((f) => f.categoryId === category.id);
  const row = summary.byCategory.find((r) => r.categoryId === category.id);
  const total = row?.totalToman ?? 0;
  const hasForecast =
    myForecast.length > 0 &&
    monthPosition(monthKey, currentJalaliMonthKey()) === "future";
  return (
    <ExpenseSheetProvider
      monthKey={monthKey}
      categories={categories}
      events={allEvents}
      learnedKeys={learnedKeys}
      fallbackCategoryId={fallback.id}
    >
      <div className="mx-auto w-full max-w-6xl px-6 pb-10 pt-4">
        <Link
          href={`/?month=${monthKey}`}
          className="text-[13px] text-ink-muted hover:text-ink"
        >
          ‹ بازگشت به دفتر
        </Link>

        <header
          className="mt-3 rounded-2xl border border-rule px-5 pb-5 pt-4"
          style={{ backgroundColor: tintOf(category.color) }}
        >
          <h1 className="flex items-center gap-2 text-[18px] font-bold">
            <CategoryDot color={category.color} />
            {category.name}
          </h1>
          <p className="mt-2">
            <span className="text-[34px] font-extrabold leading-[1.35] tabular-nums">
              {formatNumber(total)}
            </span>
            <small className="ms-2 text-[13.5px] font-medium text-ink-muted">
              تومان
            </small>
          </p>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">
            {jalaliMonthLabel(fromJalaliMonthKey(monthKey))}
            {hasForecast && " — ثبت‌شده + پیش‌بینی"}
          </p>
        </header>

        <CategoryDrilldownPanel
          monthKey={monthKey}
          category={category}
          expenses={mine}
          forecast={myForecast}
          categories={categories}
        />
      </div>
    </ExpenseSheetProvider>
  );
}
