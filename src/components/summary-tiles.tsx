import Link from "next/link";
import { CategoryMosaic } from "./category-mosaic";
import type { Category } from "@/lib/services";
import type { MonthSummary } from "@/lib/services";

// The tile mosaic (ticket 07 v2 / ticket 26): one tile per category that has
// money this month (recorded + forecast, from the summary's byCategory),
// sized by its share — see category-mosaic.tsx for the shared anatomy.
// Each tile links to its category drilldown.

export function SummaryTiles({
  monthKey,
  summary,
  categories,
}: {
  monthKey: string;
  summary: MonthSummary;
  categories: Category[];
}) {
  if (summary.byCategory.length === 0) return null;

  return (
    <CategoryMosaic
      rows={summary.byCategory}
      categories={categories}
      renderTile={({ row, tileClass, tileStyle, content }) => (
        <Link
          key={row.categoryId}
          href={`/categories/${row.categoryId}?month=${monthKey}`}
          className={`${tileClass} hover:border-rule-strong`}
          style={tileStyle}
        >
          {content}
        </Link>
      )}
    />
  );
}
