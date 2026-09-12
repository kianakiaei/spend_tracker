// Five bottom tabs (expo-mobile tickets 10–12): Home, Categories, Events,
// Templates, Insights. Titles mirror MOBILE_TABS in apps/mobile/src/routes.ts.
// Search lives behind the header search action (left) as a stack screen;
// logout sits header-right on Home only, so stack screens keep a clean back
// header. Every tab shows its native header with the title centered.

import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { ColorValue } from "react-native";
import type { ComponentProps } from "react";
import { FONT_FAMILY_BOLD } from "../../src/font-weights";
import { MOBILE_TABS } from "../../src/routes";
import {
  HeaderLogoutAction,
  HeaderSearchAction,
} from "../../components/header-actions";

const TITLES = Object.fromEntries(MOBILE_TABS.map((t) => [t.name, t.title]));

type IoniconName = ComponentProps<typeof Ionicons>["name"];

function tabIcon(filled: IoniconName, outline: IoniconName) {
  function TabBarIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    // The tab bar always hands down a plain color string; icons stay compact
    // so labels never clip (expo web).
    return (
      <Ionicons
        name={focused ? filled : outline}
        size={22}
        color={typeof color === "string" ? color : "#1c1a17"}
      />
    );
  }
  return TabBarIcon;
}

// Native headers carry the search shortcut (left) with the title centered;
// native tab labels and header titles wear Vazirmatn Bold explicitly (they
// are not RN Text, so the T wrapper cannot reach them). The bar is tall
// enough for icon + label on expo web without clipping.
const headerTitleStyle = { fontFamily: FONT_FAMILY_BOLD };

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerTitleAlign: "center",
        headerTitleStyle,
        headerLeft: () => <HeaderSearchAction />,
        tabBarLabelStyle: { fontFamily: FONT_FAMILY_BOLD, fontSize: 11 },
        tabBarActiveTintColor: "#1a7a5c",
        tabBarStyle: { height: 64, paddingTop: 6, paddingBottom: 8 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: TITLES["index"],
          tabBarIcon: tabIcon("home", "home-outline"),
          headerRight: () => <HeaderLogoutAction />,
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: TITLES["categories"],
          tabBarIcon: tabIcon("grid", "grid-outline"),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: TITLES["events"],
          tabBarIcon: tabIcon("calendar", "calendar-outline"),
        }}
      />
      <Tabs.Screen
        name="templates"
        options={{
          title: TITLES["templates"],
          tabBarIcon: tabIcon("repeat", "repeat-outline"),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: TITLES["insights"],
          tabBarIcon: tabIcon("stats-chart", "stats-chart-outline"),
        }}
      />
    </Tabs>
  );
}
