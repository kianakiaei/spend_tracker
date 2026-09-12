import { describe, expect, it } from "vitest";

// Expo-mobile ticket 18 (truthful back titles): the origin tab recorded on
// focus is what pushed screens show on their back button.

import {
  getLastTabLabel,
  resetLastTabLabel,
  setLastTabLabel,
} from "../../apps/mobile/src/last-tab";

describe("origin tab tracking (ticket 18)", () => {
  it("starts on the initial tab, where Back lands for deep links", () => {
    resetLastTabLabel();
    expect(getLastTabLabel()).toBe("خانه");
  });

  it("remembers the last focused tab", () => {
    resetLastTabLabel();
    setLastTabLabel("دسته‌ها");
    expect(getLastTabLabel()).toBe("دسته‌ها");
    setLastTabLabel("رویدادها");
    expect(getLastTabLabel()).toBe("رویدادها");
  });
});
