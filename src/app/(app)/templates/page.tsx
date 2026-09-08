import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { TemplatesManager } from "@/components/templates-manager";
import {
  currentJalaliMonthKey,
  shiftJalaliMonthKey,
} from "@/lib/jalali";
import {
  createCategoryService,
  createExpenseService,
  createRecurringService,
} from "@/lib/services";

// The templates page (ticket 28): the recurring list with pause/resume and
// the «خرج این ماه» link, plus the future-months preview (decision 15). An
// RSC reading the services DIRECTLY (ticket 12) — the manager's mutations
// alone go through the typed v1 client.

const categoryService = createCategoryService(db);
const expenseService = createExpenseService(db);
const recurringService = createRecurringService(db);

/** The horizon the preview shows: the next three Jalali months. */
const PREVIEW_MONTHS = 3;

export default async function TemplatesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const userId = session.user.id;

  const currentMonthKey = currentJalaliMonthKey();

  const [templates, categories, expenses, ...previews] = await Promise.all([
    recurringService.list(userId),
    categoryService.list(userId),
    expenseService.listByMonth(userId, currentMonthKey),
    ...Array.from({ length: PREVIEW_MONTHS }, (_, index) =>
      recurringService.preview(
        userId,
        shiftJalaliMonthKey(currentMonthKey, index + 1),
      ),
    ),
  ]);

  const generatedThisMonth: Record<string, string> = {};
  for (const expense of expenses) {
    if (expense.sourceRecurringId !== null) {
      generatedThisMonth[expense.sourceRecurringId] = expense.id;
    }
  }

  return (
    <div className="mx-auto w-full max-w-[680px] px-6 pb-10 pt-4">
      <Link href="/" className="text-[13px] text-ink-muted hover:text-ink">
        ‹ بازگشت به دفتر
      </Link>
      <h1 className="mt-2 text-[20px] font-bold">الگوهای تکرار</h1>
      <p className="mt-1 text-[13px] leading-7 text-ink-muted">
        هر الگو در ماه‌های فعالش خودکار خرج می‌سازد؛ ساختن و ویرایش الگو به
        دسته‌بندی یاد می‌گیرد.
      </p>
      <TemplatesManager
        initialTemplates={templates}
        categories={categories}
        currentMonthKey={currentMonthKey}
        generatedThisMonth={generatedThisMonth}
        previewMonths={previews
          .map((rows, index) => ({
            monthKey: shiftJalaliMonthKey(currentMonthKey, index + 1),
            rows,
          }))
          .filter(({ rows }) => rows.length > 0)}
      />
    </div>
  );
}
