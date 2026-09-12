import { and, eq, inArray } from "drizzle-orm";
import { expenses } from "@/db/schema";
import { canonical } from "@/lib/categorization/normalize";
import {
  averageUnitPrice,
  totalQuantity,
  unitPrice,
} from "@spend-tracker/shared/quantity";
import type { DomainDb } from "./types";

export interface InsightsPoint {
  expenseId: string;
  monthKey: string;
  occurredAt: string;
  unitPrice: number;
  quantity: number;
  amountToman: number;
}

export interface InsightsMonthAvg {
  monthKey: string;
  count: number;
  totalToman: number;
  totalQuantity: number;
  avgUnitPrice: number;
}

export interface ProductInsight {
  key: string;
  displayTitle: string;
  count: number;
  totalToman: number;
  totalQuantity: number;
  overallAvgUnit: number;
  monthly: InsightsMonthAvg[];
  points: InsightsPoint[];
}

export interface ProductYearStat {
  year: string;
  count: number;
  totalToman: number;
  totalQuantity: number;
  avgUnitPrice: number;
}

export interface AllTimeProductInsight {
  key: string;
  displayTitle: string;
  count: number;
  totalToman: number;
  totalQuantity: number;
  overallAvgUnit: number;
  yearly: ProductYearStat[];
  points: InsightsPoint[];
}

export function createInsightsService(db: DomainDb) {
  async function getTopProducts(
    userId: string,
    monthKeys: string[],
    limit = 20,
  ): Promise<ProductInsight[]> {
    if (monthKeys.length === 0) return [];
    const rows = await db
      .select()
      .from(expenses)
      .where(
        and(
          eq(expenses.userId, userId),
          inArray(expenses.monthKey, monthKeys),
        ),
      );

    const groups = new Map<string, typeof rows>();
    for (const row of rows) {
      const key = canonical(row.title);
      if (key === "") continue;
      const list = groups.get(key);
      if (list) list.push(row);
      else groups.set(key, [row]);
    }

    const insights: ProductInsight[] = [];
    for (const [key, list] of groups) {
      if (list.length < 2) continue;
      const sorted = [...list].sort((a, b) => {
        const da = a.occurredAt;
        const dbb = b.occurredAt;
        if (da !== dbb) return da < dbb ? -1 : 1;
        return (
          a.createdAt.getTime() - b.createdAt.getTime() ||
          (a.id < b.id ? -1 : 1)
        );
      });
      const totalToman = sorted.reduce((s, r) => s + r.amountToman, 0);
      const totalQty = totalQuantity(sorted.map((r) => r.quantity));
      const monthly: InsightsMonthAvg[] = monthKeys.map((monthKey) => {
        const inMonth = sorted.filter((r) => r.monthKey === monthKey);
        const mTotal = inMonth.reduce((s, r) => s + r.amountToman, 0);
        const mQty = totalQuantity(inMonth.map((r) => r.quantity));
        return {
          monthKey,
          count: inMonth.length,
          totalToman: mTotal,
          totalQuantity: mQty,
          avgUnitPrice: averageUnitPrice(mTotal, mQty),
        };
      });
      insights.push({
        key,
        displayTitle: sorted[0]!.title.trim(),
        count: sorted.length,
        totalToman,
        totalQuantity: totalQty,
        overallAvgUnit: averageUnitPrice(totalToman, totalQty),
        monthly,
        points: sorted.map((r) => {
          return {
            expenseId: r.id,
            monthKey: r.monthKey,
            occurredAt: r.occurredAt,
            unitPrice: unitPrice(r.amountToman, r.quantity),
            quantity: r.quantity ?? 1,
            amountToman: r.amountToman,
          };
        }),
      });
    }

    insights.sort((a, b) => b.count - a.count || b.totalToman - a.totalToman);
    return insights.slice(0, limit);
  }

  /** Jalali years the user has any expense in, newest first. */
  async function getAvailableYears(userId: string): Promise<string[]> {
    const rows = await db
      .selectDistinct({ monthKey: expenses.monthKey })
      .from(expenses)
      .where(eq(expenses.userId, userId));
    const years = new Set<string>();
    for (const row of rows) years.add(row.monthKey.slice(0, 4));
    return [...years].sort().reverse();
  }

  /** Top repeat products across ALL time, bucketed by Jalali year. */
  async function getTopProductsAllTime(
    userId: string,
    limit = 20,
  ): Promise<AllTimeProductInsight[]> {
    const rows = await db
      .select()
      .from(expenses)
      .where(eq(expenses.userId, userId));

    const groups = new Map<string, typeof rows>();
    for (const row of rows) {
      const key = canonical(row.title);
      if (key === "") continue;
      const list = groups.get(key);
      if (list) list.push(row);
      else groups.set(key, [row]);
    }

    const insights: AllTimeProductInsight[] = [];
    for (const [key, list] of groups) {
      if (list.length < 2) continue;
      const sorted = [...list].sort((a, b) => {
        const da = a.occurredAt;
        const dbb = b.occurredAt;
        if (da !== dbb) return da < dbb ? -1 : 1;
        return (
          a.createdAt.getTime() - b.createdAt.getTime() ||
          (a.id < b.id ? -1 : 1)
        );
      });
      const totalToman = sorted.reduce((s, r) => s + r.amountToman, 0);
      const totalQty = totalQuantity(sorted.map((r) => r.quantity));
      const byYear = new Map<string, typeof sorted>();
      for (const r of sorted) {
        const year = r.monthKey.slice(0, 4);
        const bucket = byYear.get(year);
        if (bucket) bucket.push(r);
        else byYear.set(year, [r]);
      }
      const yearly: ProductYearStat[] = [...byYear.entries()]
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([year, inYear]) => {
          const yTotal = inYear.reduce((s, r) => s + r.amountToman, 0);
          const yQty = totalQuantity(inYear.map((r) => r.quantity));
          return {
            year,
            count: inYear.length,
            totalToman: yTotal,
            totalQuantity: yQty,
            avgUnitPrice: averageUnitPrice(yTotal, yQty),
          };
        });
      insights.push({
        key,
        displayTitle: sorted[0]!.title.trim(),
        count: sorted.length,
        totalToman,
        totalQuantity: totalQty,
        overallAvgUnit: averageUnitPrice(totalToman, totalQty),
        yearly,
        points: sorted.map((r) => {
          return {
            expenseId: r.id,
            monthKey: r.monthKey,
            occurredAt: r.occurredAt,
            unitPrice: unitPrice(r.amountToman, r.quantity),
            quantity: r.quantity ?? 1,
            amountToman: r.amountToman,
          };
        }),
      });
    }

    insights.sort((a, b) => b.count - a.count || b.totalToman - a.totalToman);
    return insights.slice(0, limit);
  }

  return { getTopProducts, getAvailableYears, getTopProductsAllTime };
}
