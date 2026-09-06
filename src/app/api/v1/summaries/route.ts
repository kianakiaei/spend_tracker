import { db } from "@/db";
import { monthQuerySchema } from "@/lib/schemas";
import { parseQuery } from "@/lib/api/parse";
import { jsonResponse, withRoute } from "@/lib/api/route";
import { requireUserId } from "@/lib/api/session";
import { createSummaryService } from "@/lib/services";

// /api/v1/summaries (ticket 12 + ticket 15's additive composite): the
// month's dashboard numbers. Future months carry `forecastToman` and a
// recorded+forecast `byCategory`; the current month's first read lazily
// generates due templates (decision 14) — all inside the service.

const summaryService = createSummaryService(db);

export const GET = withRoute(async (request: Request) => {
  const userId = await requireUserId(request);
  const { month } = parseQuery(request, monthQuerySchema);
  const summary = await summaryService.getSummary(userId, month);
  return jsonResponse(summary);
});
