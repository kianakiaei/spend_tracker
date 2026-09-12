// Mobile shell route table (expo-mobile ticket 02).
//
// Five bottom tabs (Home, Categories, Events, Search, More) plus stack
// drilldowns for a category and an event, and the four in-app auth screens.
// Kept as pure data so the shell contract is unit-testable without Expo;
// apps/mobile/app mirrors this table 1:1 in its Expo Router layout.

export interface MobileTab {
  /** Expo Router route name inside app/(tabs). */
  name: string;
  /** Persian tab label. */
  title: string;
}

export const MOBILE_TABS: MobileTab[] = [
  { name: "index", title: "خانه" },
  { name: "categories", title: "دسته‌ها" },
  { name: "events", title: "رویدادها" },
  { name: "search", title: "جست‌وجو" },
  { name: "more", title: "بیشتر" },
];

/** Stack drilldowns pushed above the tabs (back navigation keeps context). */
export const MOBILE_STACK_ROUTES: string[] = ["category/[id]", "event/[id]"];

/** In-app auth screens (verified-email gate + resend live here). */
export const MOBILE_AUTH_ROUTES: string[] = [
  "(auth)/sign-in",
  "(auth)/sign-up",
  "(auth)/forgot",
  "(auth)/reset",
];
