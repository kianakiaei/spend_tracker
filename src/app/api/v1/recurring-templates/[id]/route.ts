import { db } from "@/db";
import { updateTemplateRequestSchema } from "@/lib/schemas";
import { emptyResponse, jsonResponse, withRoute, type IdCtx } from "@/lib/api/route";
import { parseJson } from "@/lib/api/parse";
import { requireUserId } from "@/lib/api/session";
import { createRecurringService } from "@/lib/services";

// /api/v1/recurring-templates/[id] (ticket 12): edit or delete a template.
// Generated expenses are independent rows and survive a delete (ticket 23).

const recurringService = createRecurringService(db);

export const PATCH = withRoute(async (request: Request, ctx: IdCtx) => {
  const userId = await requireUserId(request);
  const { id } = await ctx.params;
  const input = await parseJson(request, updateTemplateRequestSchema);
  const template = await recurringService.update(userId, id, input);
  return jsonResponse(template);
});

export const DELETE = withRoute(async (request: Request, ctx: IdCtx) => {
  const userId = await requireUserId(request);
  const { id } = await ctx.params;
  await recurringService.remove(userId, id);
  return emptyResponse();
});
