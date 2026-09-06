import { db } from "@/db";
import { updateCategoryRequestSchema } from "@/lib/schemas";
import { emptyResponse, jsonResponse, withRoute } from "@/lib/api/route";
import { parseJson } from "@/lib/api/parse";
import { requireUserId } from "@/lib/api/session";
import { createCategoryService } from "@/lib/services";

// /api/v1/categories/[id] (ticket 12): rename/restyle freely (even system
// categories); DELETE refuses the three domain conflicts with 409 — a
// system category, one that still has expenses, or one a recurring
// template points at.

type IdCtx = { params: Promise<{ id: string }> };

const categoryService = createCategoryService(db);

export const PATCH = withRoute(async (request: Request, ctx: IdCtx) => {
  const userId = await requireUserId(request);
  const { id } = await ctx.params;
  const input = await parseJson(request, updateCategoryRequestSchema);
  const category = await categoryService.update(userId, id, input);
  return jsonResponse(category);
});

export const DELETE = withRoute(async (request: Request, ctx: IdCtx) => {
  const userId = await requireUserId(request);
  const { id } = await ctx.params;
  await categoryService.remove(userId, id);
  return emptyResponse();
});
