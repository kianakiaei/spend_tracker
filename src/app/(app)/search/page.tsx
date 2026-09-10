import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { SearchBoard } from "@/components/search-board";
import { ExpenseSheetProvider } from "@/components/expense-sheet/provider";
import { currentJalaliMonthKey } from "@/lib/jalali";
import {
  createCategoryService,
  createEventService,
  createExpenseService,
  getFallbackCategory,
  listLearnedKeys,
} from "@/lib/services";

// The whole-ledger search page (تیکت جست‌وجو): the user types an item and
// sees every purchase of it across ALL months — which Jalali month it was
// bought in and for how much. The RSC fetches the newest ledger slice once
// through the service; the client board narrows it live as the user types.
// A click opens the same edit sheet as the home ledger.

const expenseService = createExpenseService(db);
const categoryService = createCategoryService(db);
const eventService = createEventService(db);

export default async function SearchPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const userId = session.user.id;

  const [results, categories, learnedKeys, fallback, allEvents] =
    await Promise.all([
      expenseService.listAll(userId),
      categoryService.list(userId),
      listLearnedKeys(db, userId),
      getFallbackCategory(db, userId),
      eventService.list(userId),
    ]);

  return (
    <ExpenseSheetProvider
      monthKey={currentJalaliMonthKey()}
      categories={categories}
      events={allEvents}
      learnedKeys={learnedKeys}
      fallbackCategoryId={fallback.id}
    >
      <SearchBoard results={results} />
    </ExpenseSheetProvider>
  );
}
