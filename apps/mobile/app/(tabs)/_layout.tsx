// Three bottom tabs (expo-mobile ticket 10): Home, Categories, Events.
// Titles mirror MOBILE_TABS in apps/mobile/src/routes.ts. Search moved to a
// stack screen behind the header search action; the More tab is gone and its
// entries live in the header «…» menu. Every tab shows its native header.

import { Tabs } from "expo-router";
import { MOBILE_TABS } from "../../src/routes";
import { HeaderActions } from "../../components/header-actions";

const TITLES = Object.fromEntries(MOBILE_TABS.map((t) => [t.name, t.title]));

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerRight: () => <HeaderActions />,
      }}
    >
      <Tabs.Screen name="index" options={{ title: TITLES["index"] }} />
      <Tabs.Screen name="categories" options={{ title: TITLES["categories"] }} />
      <Tabs.Screen name="events" options={{ title: TITLES["events"] }} />
    </Tabs>
  );
}
