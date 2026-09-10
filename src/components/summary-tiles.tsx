import Link from "next/link";
import { CategoryDot, tintOf } from "./category-color";
import { formatNumber, formatPercent } from "@/lib/format";
import type { Category } from "@/lib/services";
import type { MonthSummary } from "@/lib/services";

// The tile mosaic (ticket 07 v2 / ticket 26): one tile per category that has
// money this month (recorded + forecast, from the summary's byCategory),
// sized by its share — the largest is the four-column double-row anchor, the
// rest span 3 / 2 / 1 columns of the six-column dense grid. Color arrives
// only through the category itself (dot + washed tint, category-color.tsx).

/** Tile spans by share — two columns on phones (a six-column grid clips
 * single-column tiles there), the ticket-07 six-column mosaic from sm up.
 * Below 25% both spans collapse to one column on phones; the percent label
 * carries the exact share. */
function spanClass(index: number, share: number): string {
  if (index === 0) return "col-span-2 row-span-2 sm:col-span-4";
  if (share >= 0.25) return "col-span-2 sm:col-span-3";
  if (share >= 0.1) return "col-span-1 sm:col-span-2";
  return "col-span-1";
}

/** Amount size for small tiles — a grouped 8-digit total (۳٬۹۱۴٬۰۰۰) at the
 * base size spills out of a single-column tile, so longer strings step
 * down; with min-w-0 + break-words below, nothing ever leaves the box. */
function amountClass(formatted: string, tall: boolean): string {
  if (tall) return "text-[21px]";
  const len = [...formatted].length;
  if (len >= 9) return "text-[12px]";
  if (len >= 7) return "text-[14px]";
  return "text-[16.5px]";
}

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
  const colorOf = new Map(categories.map((c) => [c.id, c.color]));
  const total = summary.totalToman;
  // Largest first — the anchor tile is the biggest share, not the first
  // category in dashboard order (ticket 26: «کاشیِ بزرگ‌ترین»).
  const ranked = [...summary.byCategory].sort(
    (a, b) => b.totalToman - a.totalToman,
  );

  return (
    <div className="mt-5 grid grid-cols-2 gap-2.5 [grid-auto-flow:dense] sm:grid-cols-6">
      {ranked.map((row, index) => {
        const color = colorOf.get(row.categoryId) ?? null;
        const share = total > 0 ? row.totalToman / total : 0;
        const tall = index === 0;
        const formatted = formatNumber(row.totalToman);
        return (
          <Link
            key={row.categoryId}
            href={`/categories/${row.categoryId}?month=${monthKey}`}
            className={`${spanClass(index, share)} ${tall ? "min-h-[186px]" : "min-h-[88px]"} flex min-w-0 flex-col justify-between gap-2.5 rounded-2xl border border-rule p-3.5 text-start hover:border-rule-strong`}
            style={{ backgroundColor: tintOf(color) }}
          >
            <span className="flex items-center gap-1.5 text-[13px] font-semibold">
              <CategoryDot color={color} />
              {row.name}
            </span>
            <span className="min-w-0">
              <span
                className={`block leading-snug break-words ${amountClass(formatted, tall)} font-bold`}
              >
                {formatted}
              </span>
              <span className="text-[11px] text-ink-muted">
                {formatPercent(share)}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
