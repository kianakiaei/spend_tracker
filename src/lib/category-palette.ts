// The one palette for categories (ticket 28 swatches, extended): the six
// system seeds, the create-form default, and five extra hues so custom
// categories stop collapsing onto the same gray. Both the manager UI and
// the service's auto-color (first unused swatch on custom create) read
// from here — one list, never two.

export interface CategorySwatch {
  hex: string;
  name: string;
}

export const DEFAULT_CATEGORY_COLOR = "#1a7a5c";

export const CATEGORY_SWATCHES: readonly CategorySwatch[] = [
  { hex: DEFAULT_CATEGORY_COLOR, name: "یشمی" },
  { hex: "#3da3c4", name: "فیروزه‌ای" },
  { hex: "#3d7fc4", name: "آبی" },
  { hex: "#7a5fc4", name: "بنفش" },
  { hex: "#c4559b", name: "سرخابی" },
  { hex: "#c47a3d", name: "نارنجی" },
  { hex: "#b3402e", name: "آجری" },
  { hex: "#82887e", name: "خاکستری" },
  { hex: "#d9a521", name: "خردلی" },
  { hex: "#65a30d", name: "لیمویی" },
  { hex: "#33477a", name: "نیلی" },
  { hex: "#8a5a2b", name: "قهوه‌ای" },
  { hex: "#0d9488", name: "سبزآبی" },
];

/** First swatch hex none of `usedColors` has — the service's auto-color for
 * a custom create without an explicit color. Null when the palette is
 * exhausted (the row keeps the gray fallback). */
export function firstUnusedSwatch(
  usedColors: ReadonlyArray<string | null | undefined>,
): string | null {
  const used = new Set(
    usedColors
      .filter((c): c is string => typeof c === "string")
      .map((c) => c.toLowerCase()),
  );
  return (
    CATEGORY_SWATCHES.find((s) => !used.has(s.hex.toLowerCase()))?.hex ?? null
  );
}
