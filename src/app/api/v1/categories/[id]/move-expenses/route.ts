import { db } from "@/db";
import { moveExpensesRequestSchema } from "@/lib/schemas";
import { parseJson } from "@/lib/api/parse";
import { jsonResponse, withRoute, type IdCtx } from "@/lib/api/route";
import { requireUserId } from "@/lib/api/session";
import { createCategoryService } from "@/lib/services";

// /api/v1/categories/[id]/move-expenses (ticket 12): the bulk move behind
// the delete-category flow (ticket 05) — every expense of `id` re-points to
// `targetCategoryId`. Learning never fires here (ticket 06).

const categoryService = createCategoryService(db);

export const POST = withRoute(async (request: Request, ctx: IdCtx) => {
  const userId = await requireUserId(request);
  const { id } = await ctx.params;
  const { targetCategoryId } = await parseJson(
    request,
    moveExpensesRequestSchema,
  );
  const { moved } = await categoryService.moveExpenses(
    userId,
    id,
    targetCategoryId,
  );
  return jsonResponse({ moved });
});
