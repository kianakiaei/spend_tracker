import { db } from "@/db";
import { searchQuerySchema } from "@/lib/schemas";
import { parseQuery } from "@/lib/api/parse";
import { jsonResponse, withRoute } from "@/lib/api/route";
import { requireUserId } from "@/lib/api/session";
import { createExpenseService } from "@/lib/services";

// GET /api/v1/search?q= (تیکت جست‌وجو): the whole-ledger title search across
// every Jalali month — the user types an item and sees which month it was
// bought in and for how much. Unlike /expenses there is NO month gate and no
// recurring generation: a search must never mutate the ledger.

const expenseService = createExpenseService(db);

export const GET = withRoute(async (request: Request) => {
  const userId = await requireUserId(request);
  const { q } = parseQuery(request, searchQuerySchema);
  const rows = await expenseService.searchByTitle(userId, q);
  return jsonResponse(rows);
});
