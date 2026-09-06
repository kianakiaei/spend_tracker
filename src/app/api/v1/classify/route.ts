import { db } from "@/db";
import { classifyRequestSchema } from "@/lib/schemas";
import { parseJson } from "@/lib/api/parse";
import { jsonResponse, withRoute } from "@/lib/api/route";
import { requireUserId } from "@/lib/api/session";
import { createClassifyService } from "@/lib/services";

// POST /api/v1/classify (ticket 12): the side-effect-free suggestion —
// always 200 on a valid title with { categoryId, source, matchedKey,
// confidence }. Learning only ever happens on expense saves (ticket 06).

const classifyService = createClassifyService(db);

export const POST = withRoute(async (request: Request) => {
  const userId = await requireUserId(request);
  const { title } = await parseJson(request, classifyRequestSchema);
  const suggestion = await classifyService.classify(userId, title);
  return jsonResponse(suggestion);
});
