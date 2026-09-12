// The one place the UI knows what a category looks like (ticket 26): its
// own color as the dot, that color washed 85% toward the paper as the tile
// tint. Categories with no color yet (custom ones until ticket 28 brings
// the swatches) fall back to the muted ink gray.
import type { Category } from "@/lib/services";
import {
  FALLBACK_CATEGORY_COLOR,
  tintOf,
} from "@spend-tracker/shared/color";

export { FALLBACK_CATEGORY_COLOR, tintOf };

export function CategoryDot({ color }: { color: string | null | undefined }) {
  return (
    <i
      className="size-[9px] shrink-0 rounded-full"
      style={{ backgroundColor: color ?? FALLBACK_CATEGORY_COLOR }}
      aria-hidden
    />
  );
}

/** The id→color lookup every row list needs for forecast rows (which carry
 * only a categoryId) — one Map per render, shared by the ledger anatomy. */
export function categoryColorMap(categories: Category[]): Map<string, string | null> {
  return new Map(categories.map((c) => [c.id, c.color]));
}
