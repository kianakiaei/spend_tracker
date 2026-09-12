// Three bottom tabs (expo-mobile ticket 10): Home, Categories, Events.
// Titles mirror MOBILE_TABS in apps/mobile/src/routes.ts. Search moved to a
// stack screen behind the header search action; the More tab is gone and its
// entries live in the header «…» menu. Every tab shows its native header.

import { Tabs } from "expo-router";
import { FONT_FAMILY_BOLD } from "../../src/font-weights";
import { MOBILE_TABS } from "../../src/routes";
import { HeaderActions } from "../../components/header-actions";

const TITLES = Object.fromEntries(MOBILE_TABS.map((t) => [t.name, t.title]));

// Native headers carry the search shortcut + «…» menu; native tab labels and
// header titles wear Vazirmatn Bold explicitly (they are not RN Text, so the
// T wrapper cannot reach them).
const headerTitleStyle = { fontFamily: FONT_FAMILY_BOLD };

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerTitleStyle,
        headerRight: () => <HeaderActions />,
        tabBarLabelStyle: { fontFamily: FONT_FAMILY_BOLD, fontSize: 12 },
        tabBarActiveTintColor: "#1a7a5c",
      }}
    >
      <Tabs.Screen name="index" options={{ title: TITLES["index"] }} />
      <Tabs.Screen name="categories" options={{ title: TITLES["categories"] }} />
      <Tabs.Screen name="events" options={{ title: TITLES["events"] }} />
    </Tabs>
  );
}
