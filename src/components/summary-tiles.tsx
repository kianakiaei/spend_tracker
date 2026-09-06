import Link from "next/link";
import { formatNumber, formatPercent } from "@/lib/format";
import type { Category } from "@/lib/services";
import type { MonthSummary } from "@/lib/services";

// The tile mosaic (ticket 07 v2 / ticket 26): one tile per category that has
// money this month (recorded + forecast, from the summary's byCategory),
// sized by its share — the largest is the four-column double-row anchor, the
// rest span 3 / 2 / 1 columns of the six-column dense grid. Color arrives
// only through the category itself: the dot keeps its color, the tile
// background is that color washed 85% toward the paper.

const FALLBACK_COLOR = "#82887e";

/** A category color washed toward the paper — the tile tint. Null colors
 * (custom categories until ticket 28 brings the swatches) fall back to the
 * muted ink gray. */
export function tintOf(color: string | null | undefined): string {
  const hex = color != null && /^#[0-9a-fA-F]{6}$/.test(color) ? color : FALLBACK_COLOR;
  const channel = (index: number) => {
    const own = Number.parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16);
    const paper = [0xfa, 0xfa, 0xf7][index];
    return Math.round(own * 0.15 + paper * 0.85)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}

function spanClass(index: number, share: number): string {
  if (index === 0) return "col-span-4 row-span-2";
  if (share >= 0.25) return "col-span-3";
  if (share >= 0.1) return "col-span-2";
  return "col-span-1";
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

  return (
    <div className="mt-5 grid grid-cols-6 gap-2.5 [grid-auto-flow:dense]">
      {summary.byCategory.map((row, index) => {
        const color = colorOf.get(row.categoryId) ?? null;
        const share = total > 0 ? row.totalToman / total : 0;
        const tall = index === 0;
        return (
          <Link
            key={row.categoryId}
            href={`/categories/${row.categoryId}?month=${monthKey}`}
            className={`${spanClass(index, share)} ${tall ? "min-h-[186px]" : "min-h-[88px]"} flex flex-col justify-between gap-2.5 rounded-2xl border border-rule p-3.5 text-start hover:border-[#d4d1c6]`}
            style={{ backgroundColor: tintOf(color) }}
          >
            <span className="flex items-center gap-1.5 text-[13px] font-semibold">
              <i
                className="size-[9px] shrink-0 rounded-full"
                style={{ backgroundColor: color ?? FALLBACK_COLOR }}
                aria-hidden
              />
              {row.name}
            </span>
            <span>
              <span
                className={`block tabular-nums ${tall ? "text-[21px]" : "text-[16.5px]"} font-bold`}
              >
                {formatNumber(row.totalToman)}
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
