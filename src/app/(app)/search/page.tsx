import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { createExpenseService } from "@/lib/services";
import { SearchBoard } from "@/components/search-board";

// The whole-ledger search page (تیکت جست‌وجو): the user types an item and
// sees every purchase of it across ALL months — which Jalali month it was
// bought in and for how much. The RSC fetches the newest ledger slice once
// through the service; the client board narrows it live as the user types.

const expenseService = createExpenseService(db);

export default async function SearchPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const results = await expenseService.listAll(session.user.id);
  return <SearchBoard results={results} />;
}
