import { db } from "@/db";
import {
  createExpenseRequestSchema,
  monthQuerySchema,
} from "@/lib/schemas";
import { parseJson, parseQuery } from "@/lib/api/parse";
import { jsonResponse, withRoute } from "@/lib/api/route";
import { requireUserId } from "@/lib/api/session";
import { createExpenseService } from "@/lib/services";

// /api/v1/expenses (ticket 12): POST registers an expense, GET lists one
// Jalali month's ledger — the current month's first read lazily generates
// due recurring expenses (decision 14, inside the service).

const expenseService = createExpenseService(db);

export const POST = withRoute(async (request: Request) => {
  const userId = await requireUserId(request);
  const input = await parseJson(request, createExpenseRequestSchema);
  const expense = await expenseService.create(userId, input);
  // The contract shape is the full row WITH its category (expenseResponseSchema)
  // — the bare insert row would fail the typed client's validation.
  return jsonResponse(await expenseService.get(userId, expense.id), 201);
});

export const GET = withRoute(async (request: Request) => {
  const userId = await requireUserId(request);
  const { month } = parseQuery(request, monthQuerySchema);
  const rows = await expenseService.listByMonth(userId, month);
  return jsonResponse(rows);
});
