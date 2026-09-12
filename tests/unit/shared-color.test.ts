import { describe, expect, it } from "vitest";

// Shared category colors (expo-mobile ticket 10): the washed tile tint must
// match the web board exactly — same input color, same output hex — and
// colorless categories fall back to the muted ink gray.

import {
  FALLBACK_CATEGORY_COLOR,
  tintOf,
} from "../../packages/shared/src/color";

describe("category tint (ticket 10)", () => {
  it("washes a color 85% toward the paper", () => {
    expect(tintOf("#1a7a5c")).toBe("#d8e7e0");
  });

  it("tints the muted ink gray without a usable color", () => {
    expect(FALLBACK_CATEGORY_COLOR).toBe("#82887e");
    for (const bad of [null, undefined, "red", "#12345"]) {
      expect(tintOf(bad)).toBe(tintOf(FALLBACK_CATEGORY_COLOR));
    }
  });

  it("keeps the tint a valid 6-digit hex", () => {
    for (const color of ["#000000", "#ffffff", "#e5484d", "#82887e"]) {
      expect(tintOf(color)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
