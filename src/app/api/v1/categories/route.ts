import { db } from "@/db";
import { createCategoryRequestSchema } from "@/lib/schemas";
import { parseJson } from "@/lib/api/parse";
import { jsonResponse, withRoute } from "@/lib/api/route";
import { requireUserId } from "@/lib/api/session";
import { createCategoryService } from "@/lib/services";

// /api/v1/categories (ticket 12): list in display order, create custom
// ones. Deletion rules (409 for populated/system categories) live on [id].

const categoryService = createCategoryService(db);

export const GET = withRoute(async (request: Request) => {
  const userId = await requireUserId(request);
  const rows = await categoryService.list(userId);
  return jsonResponse(rows);
});

export const POST = withRoute(async (request: Request) => {
  const userId = await requireUserId(request);
  const input = await parseJson(request, createCategoryRequestSchema);
  const category = await categoryService.create(userId, input);
  return jsonResponse(category, 201);
});
