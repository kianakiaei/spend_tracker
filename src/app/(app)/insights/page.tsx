import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { createInsightsService } from "@/lib/services";
import { InsightsBoard } from "@/components/insights-board";

const insightsService = createInsightsService(db);

export default async function InsightsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const products = await insightsService.getTopProductsAllTime(
    session.user.id,
    20,
  );
  return <InsightsBoard products={products} />;
}
