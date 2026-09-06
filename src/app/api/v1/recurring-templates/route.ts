import { db } from "@/db";
import { createTemplateRequestSchema } from "@/lib/schemas";
import { parseJson } from "@/lib/api/parse";
import { jsonResponse, withRoute } from "@/lib/api/route";
import { requireUserId } from "@/lib/api/session";
import { createRecurringService } from "@/lib/services";

// /api/v1/recurring-templates (ticket 12): list in creation order, create.
// Template saves teach the categorizer (decision 06) — inside the service.
// The forecast read lives on the sibling /preview route.

const recurringService = createRecurringService(db);

export const GET = withRoute(async (request: Request) => {
  const userId = await requireUserId(request);
  const rows = await recurringService.list(userId);
  return jsonResponse(rows);
});

export const POST = withRoute(async (request: Request) => {
  const userId = await requireUserId(request);
  const input = await parseJson(request, createTemplateRequestSchema);
  const template = await recurringService.create(userId, input);
  return jsonResponse(template, 201);
});
