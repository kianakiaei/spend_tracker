import { db } from "@/db";
import { updateExpenseRequestSchema } from "@/lib/schemas";
import { emptyResponse, jsonResponse, withRoute, type IdCtx } from "@/lib/api/route";
import { parseJson } from "@/lib/api/parse";
import { requireUserId } from "@/lib/api/session";
import { createExpenseService } from "@/lib/services";

// /api/v1/expenses/[id] (ticket 12): read one expense with its category,
// patch its fields, delete it. Unknown or foreign ids are the service's 404;
// deleting is free.

const expenseService = createExpenseService(db);

export const GET = withRoute(async (request: Request, ctx: IdCtx) => {
  const userId = await requireUserId(request);
  const { id } = await ctx.params;
  const expense = await expenseService.get(userId, id);
  return jsonResponse(expense);
});

export const PATCH = withRoute(async (request: Request, ctx: IdCtx) => {
  const userId = await requireUserId(request);
  const { id } = await ctx.params;
  const input = await parseJson(request, updateExpenseRequestSchema);
  const expense = await expenseService.update(userId, id, input);
  return jsonResponse(expense);
});

export const DELETE = withRoute(async (request: Request, ctx: IdCtx) => {
  const userId = await requireUserId(request);
  const { id } = await ctx.params;
  await expenseService.remove(userId, id);
  return emptyResponse();
});
