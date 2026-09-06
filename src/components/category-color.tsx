// The one place the UI knows what a category looks like (ticket 26): its
// own color as the dot, that color washed 85% toward the paper as the tile
// tint. Categories with no color yet (custom ones until ticket 28 brings
// the swatches) fall back to the muted ink gray.

export const FALLBACK_CATEGORY_COLOR = "#82887e";

const PAPER = [0xfa, 0xfa, 0xf7];

export function tintOf(color: string | null | undefined): string {
  const hex =
    color != null && /^#[0-9a-fA-F]{6}$/.test(color)
      ? color
      : FALLBACK_CATEGORY_COLOR;
  const channel = (index: number) => {
    const own = Number.parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16);
    return Math.round(own * 0.15 + PAPER[index]! * 0.85)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}

export function CategoryDot({ color }: { color: string | null | undefined }) {
  return (
    <i
      className="size-[9px] shrink-0 rounded-full"
      style={{ backgroundColor: color ?? FALLBACK_CATEGORY_COLOR }}
      aria-hidden
    />
  );
}
