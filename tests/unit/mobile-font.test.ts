import { describe, expect, it } from "vitest";

// Expo-mobile ticket 10 (Vazirmatn): the weight→family mapping behind the T
// wrapper. Headings (800+) resolve to ExtraBold, 600+ to Bold, everything
// else (including unset weights) to Regular — the three static TTFs shipped
// in apps/mobile/assets/fonts.

import {
  FONT_FAMILY_BOLD,
  FONT_FAMILY_EXTRA_BOLD,
  FONT_FAMILY_REGULAR,
  fontFamilyForWeight,
} from "../../apps/mobile/src/font-weights";

describe("Vazirmatn weight mapping (ticket 10)", () => {
  it("maps heavy headings to ExtraBold", () => {
    expect(fontFamilyForWeight("800")).toBe(FONT_FAMILY_EXTRA_BOLD);
    expect(fontFamilyForWeight("900")).toBe(FONT_FAMILY_EXTRA_BOLD);
    expect(fontFamilyForWeight(800)).toBe(FONT_FAMILY_EXTRA_BOLD);
  });

  it("maps bold labels to Bold", () => {
    expect(fontFamilyForWeight("bold")).toBe(FONT_FAMILY_BOLD);
    expect(fontFamilyForWeight("700")).toBe(FONT_FAMILY_BOLD);
    expect(fontFamilyForWeight("600")).toBe(FONT_FAMILY_BOLD);
  });

  it("falls back to Regular for body text and unknown weights", () => {
    expect(fontFamilyForWeight(undefined)).toBe(FONT_FAMILY_REGULAR);
    expect(fontFamilyForWeight("normal")).toBe(FONT_FAMILY_REGULAR);
    expect(fontFamilyForWeight("400")).toBe(FONT_FAMILY_REGULAR);
    expect(fontFamilyForWeight("300")).toBe(FONT_FAMILY_REGULAR);
    expect(fontFamilyForWeight("weird")).toBe(FONT_FAMILY_REGULAR);
  });
});
