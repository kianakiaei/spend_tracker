// Five bottom tabs (expo-mobile ticket 02): Home, Categories, Events, Search,
// More. Titles mirror MOBILE_TABS in apps/mobile/src/routes.ts.

import { Tabs } from "expo-router";
import { MOBILE_TABS } from "../../src/routes";

const TITLES = Object.fromEntries(MOBILE_TABS.map((t) => [t.name, t.title]));

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: TITLES["index"] }} />
      <Tabs.Screen name="categories" options={{ title: TITLES["categories"] }} />
      <Tabs.Screen name="events" options={{ title: TITLES["events"] }} />
      <Tabs.Screen name="search" options={{ title: TITLES["search"] }} />
      <Tabs.Screen name="more" options={{ title: TITLES["more"] }} />
    </Tabs>
  );
}
