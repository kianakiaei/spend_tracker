// Root layout (expo-mobile ticket 02): RTL shell, session restore, and the
// auth gate. Verified users land in the five-tab shell; signed-out users see
// only the in-app auth screens. Mirrors apps/mobile/src/routes.ts 1:1.

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, I18nManager, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider, useSession } from "../src/session";

function RootNavigator() {
  const { session, status } = useSession();

  useEffect(() => {
    // Whole app right-to-left with Persian digits (spec: reads like the web).
    if (!I18nManager.isRTL) {
      I18nManager.allowRTL(true);
      I18nManager.forceRTL(true);
    }
  }, []);

  if (status === "loading") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="category/[id]" options={{ headerShown: true, title: "دسته" }} />
          <Stack.Screen name="event/[id]" options={{ headerShown: true, title: "رویداد" }} />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="(auth)/sign-in" />
          <Stack.Screen name="(auth)/sign-up" />
          <Stack.Screen name="(auth)/forgot" />
          <Stack.Screen name="(auth)/reset" />
        </Stack.Protected>
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <RootNavigator />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
