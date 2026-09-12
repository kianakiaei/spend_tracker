// Three bottom tabs (expo-mobile tickets 10 + 11): Home, Categories, Events.
// Titles mirror MOBILE_TABS in apps/mobile/src/routes.ts. Search moved to a
// stack screen behind the header search action; the More tab is gone and its
// entries live in the header «…» menu. Every tab shows its native header
// with the title centered, search on the left, and the menu on the right.

import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { ColorValue } from "react-native";
import type { ComponentProps } from "react";
import { FONT_FAMILY_BOLD } from "../../src/font-weights";
import { MOBILE_TABS } from "../../src/routes";
import {
  HeaderMenuAction,
  HeaderSearchAction,
} from "../../components/header-actions";

const TITLES = Object.fromEntries(MOBILE_TABS.map((t) => [t.name, t.title]));

type IoniconName = ComponentProps<typeof Ionicons>["name"];

function tabIcon(filled: IoniconName, outline: IoniconName) {
  function TabBarIcon({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) {
    // The tab bar always hands down a plain color string.
    return (
      <Ionicons
        name={focused ? filled : outline}
        size={size}
        color={typeof color === "string" ? color : "#1c1a17"}
      />
    );
  }
  return TabBarIcon;
}

// Native headers carry the search shortcut (left) + «…» menu (right) with
// the title centered; native tab labels and header titles wear Vazirmatn
// Bold explicitly (they are not RN Text, so the T wrapper cannot reach them).
const headerTitleStyle = { fontFamily: FONT_FAMILY_BOLD };

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerTitleAlign: "center",
        headerTitleStyle,
        headerLeft: () => <HeaderSearchAction />,
        headerRight: () => <HeaderMenuAction />,
        tabBarLabelStyle: { fontFamily: FONT_FAMILY_BOLD, fontSize: 12 },
        tabBarActiveTintColor: "#1a7a5c",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: TITLES["index"],
          tabBarIcon: tabIcon("home", "home-outline"),
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
    </Tabs>
  );
}
