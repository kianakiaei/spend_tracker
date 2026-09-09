import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { CategoriesManager } from "@/components/categories-manager";
import {
  createCategoryService,
  createExpenseService,
  createRecurringService,
} from "@/lib/services";

// The categories page (ticket 28): the whole manage flow — add with a
// swatch, rename freely (system ones included), delete behind the guard.
// An RSC reading the services DIRECTLY (ticket 12), guarded like the
// dashboard. The per-category counters (all-time expenses + templates)
// come from the two GROUP-BY reads landed with this ticket.

const categoryService = createCategoryService(db);
const expenseService = createExpenseService(db);
const recurringService = createRecurringService(db);

export default async function CategoriesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const userId = session.user.id;

  const [categories, expenseCounts, templateCounts] = await Promise.all([
    categoryService.list(userId),
    expenseService.countByCategory(userId),
    recurringService.countByCategory(userId),
  ]);

  return (
    <div className="mx-auto w-full max-w-[680px] px-6 pb-10 pt-4">
      <Link href="/" className="text-[13px] text-ink-muted hover:text-ink">
        ‹ بازگشت به دفتر
      </Link>
      <h1 className="mt-2 text-[20px] font-bold">دسته‌ها</h1>
      <p className="mt-1 text-[13px] leading-7 text-ink-muted">
        دسته‌های سیستمی حذف نمی‌شوند؛ نام هر دسته آزادانه تغییر می‌کند. دستهٔ
        پُر، اول انتقال خرج‌ها و بعد حذف.
      </p>
      <CategoriesManager
        initialCategories={categories}
        expenseCounts={expenseCounts}
        templateCounts={templateCounts}
      />
    </div>
  );
}
