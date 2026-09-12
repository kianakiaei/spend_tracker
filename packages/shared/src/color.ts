// Category color helpers — the one place the UI knows what a category looks
// like: its own color as the dot, that color washed 85% toward the paper as
// the tile tint. Categories with no color fall back to the muted ink gray.
// Moved verbatim from the web `category-color` module (expo-mobile ticket
// 10) so web and mobile tint identically; the web module re-exports these.

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
