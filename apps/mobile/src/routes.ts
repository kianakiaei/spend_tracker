// Mobile shell route table (expo-mobile tickets 02 + 10 + 12).
//
// Five bottom tabs (Home, Categories, Events, Templates, Insights); search
// and the category/event details are stack screens above the tabs (ticket
// 12: templates + insights moved from the header menu into the bar, so the
// menu is gone and logout lives header-right on Home only — stack screens
// keep a clean back header). Kept as pure data so the shell contract is
// unit-testable without Expo; apps/mobile/app mirrors this table 1:1 in its
// Expo Router layout.

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
  { name: "templates", title: "الگوها" },
  { name: "insights", title: "بینش‌ها" },
];

/** Stack screens pushed above the tabs (back navigation keeps context):
 * the two drilldowns plus search. */
export const MOBILE_STACK_ROUTES: string[] = [
  "category/[id]",
  "event/[id]",
  "search",
];

/** In-app auth screens (verified-email gate + resend live here). */
export const MOBILE_AUTH_ROUTES: string[] = [
  "(auth)/sign-in",
  "(auth)/sign-up",
  "(auth)/forgot",
  "(auth)/reset",
];

/** Root landing: the welcome/intro screen. Declared first in the root Stack
 * so `/` always lands here — signed-out users get the intro with login and
 * signup links, signed-in users redirect straight into the tabs. Without an
 * explicit first screen the initial route fell through to the last-declared
 * auth screen (reset). */
export const WELCOME_ROUTE = "index";
