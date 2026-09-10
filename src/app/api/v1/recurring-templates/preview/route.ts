import { db } from "@/db";
import { monthQuerySchema } from "@/lib/schemas";
import { parseQuery } from "@/lib/api/parse";
import { jsonResponse, withRoute } from "@/lib/api/route";
import { requireUserId } from "@/lib/api/session";
import { createRecurringService } from "@/lib/services";

// /api/v1/recurring-templates/preview (ticket 15's additive read): the
// forecast rows of a FUTURE Jalali month — active due templates with the
// clamped day, never generated into expenses (decision 14 keeps read-side
// generation current-month-only). Current/past months render 200 [] (the
// current month has real generated expenses; past months hold theirs once a
// template save backfilled them).
//
// Routing note: the static `preview` segment wins over [id] — which only
// exposes PATCH/DELETE anyway.

const recurringService = createRecurringService(db);

export const GET = withRoute(async (request: Request) => {
  const userId = await requireUserId(request);
  const { month } = parseQuery(request, monthQuerySchema);
  const rows = await recurringService.preview(userId, month);
  return jsonResponse(rows);
});
