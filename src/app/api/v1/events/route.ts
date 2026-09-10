import { db } from "@/db";
import { createEventRequestSchema } from "@/lib/schemas";
import { parseJson } from "@/lib/api/parse";
import { jsonResponse, withRoute } from "@/lib/api/route";
import { requireUserId } from "@/lib/api/session";
import { createEventService } from "@/lib/services";

// /api/v1/events: list in creation order, create named buckets.
// Deleting an event only unlinks expenses (on [id]).

const eventService = createEventService(db);

export const GET = withRoute(async (request: Request) => {
  const userId = await requireUserId(request);
  const rows = await eventService.list(userId);
  return jsonResponse(rows);
});

export const POST = withRoute(async (request: Request) => {
  const userId = await requireUserId(request);
  const input = await parseJson(request, createEventRequestSchema);
  const event = await eventService.create(userId, input);
  return jsonResponse(event, 201);
});
