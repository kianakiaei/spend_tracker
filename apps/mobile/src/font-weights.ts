// Vazirmatn family names + weight mapping (expo-mobile ticket 10, pure).
//
// The app ships three static Vazirmatn TTFs (react-native cannot use the web
// woff2 variable file). They load under these family names (see font.ts);
// this module maps an RN fontWeight to the closest loaded family — 800+
// headings get ExtraBold, 600+ Bold, everything else Regular — so every
// surface speaks Vazirmatn without touching a single screen style.

export const FONT_FAMILY_REGULAR = "Vazirmatn-Regular";
export const FONT_FAMILY_BOLD = "Vazirmatn-Bold";
export const FONT_FAMILY_EXTRA_BOLD = "Vazirmatn-ExtraBold";

export function fontFamilyForWeight(
  weight: string | number | undefined,
): string {
  const numeric =
    weight === "bold" ? 700 : weight === "normal" ? 400 : Number(weight);
  if (Number.isFinite(numeric) && numeric >= 800) return FONT_FAMILY_EXTRA_BOLD;
  if (Number.isFinite(numeric) && numeric >= 600) return FONT_FAMILY_BOLD;
  return FONT_FAMILY_REGULAR;
}
