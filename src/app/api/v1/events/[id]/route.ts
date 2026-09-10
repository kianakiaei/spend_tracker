import { db } from "@/db";
import { updateEventRequestSchema } from "@/lib/schemas";
import { emptyResponse, jsonResponse, withRoute, type IdCtx } from "@/lib/api/route";
import { parseJson } from "@/lib/api/parse";
import { requireUserId } from "@/lib/api/session";
import { createEventService } from "@/lib/services";

// /api/v1/events/[id]: read one event, rename it, delete it (delete only
// unlinks expenses — rows keep their category and month).

const eventService = createEventService(db);

export const GET = withRoute(async (request: Request, ctx: IdCtx) => {
  const userId = await requireUserId(request);
  const { id } = await ctx.params;
  const event = await eventService.get(userId, id);
  return jsonResponse(event);
});

export const PATCH = withRoute(async (request: Request, ctx: IdCtx) => {
  const userId = await requireUserId(request);
  const { id } = await ctx.params;
  const input = await parseJson(request, updateEventRequestSchema);
  const updated = await eventService.update(userId, id, input);
  return jsonResponse(updated);
});

export const DELETE = withRoute(async (request: Request, ctx: IdCtx) => {
  const userId = await requireUserId(request);
  const { id } = await ctx.params;
  await eventService.remove(userId, id);
  return emptyResponse();
});
