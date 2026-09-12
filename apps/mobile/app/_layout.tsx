// Root layout (expo-mobile tickets 02-03): RTL shell, session restore, the
// auth gate, and the query-caching data layer over the typed client.
// Verified users land in the five-tab shell; signed-out users see only the
// in-app auth screens. Mirrors apps/mobile/src/routes.ts 1:1.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, I18nManager, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider, useSession } from "../src/session";
import { SheetHostProvider } from "../components/sheet-host";
import { loadAppFonts } from "../src/font";
import { FONT_FAMILY_BOLD } from "../src/font-weights";

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
        {/* Landing first: `/` always resolves here (intro + login/signup
            links, or a redirect into the tabs when signed in). */}
        <Stack.Screen name="index" />
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="category/[id]" options={{ headerShown: true, title: "دسته", headerTitleStyle: { fontFamily: FONT_FAMILY_BOLD } }} />
          <Stack.Screen name="event/[id]" options={{ headerShown: true, title: "رویداد", headerTitleStyle: { fontFamily: FONT_FAMILY_BOLD } }} />
          <Stack.Screen name="search" options={{ headerShown: true, title: "جست‌وجو", headerTitleStyle: { fontFamily: FONT_FAMILY_BOLD } }} />
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
  // One cache for the ticket-03 dashboard scopes (per-month dashboard reads
  // plus the category/event/search/insight lists mutations invalidate).
  const [queryClient] = useState(() => new QueryClient());
  // Vazirmatn first: every Text renders through the T wrapper's families,
  // so hold first paint until expo-font has them (ticket 10).
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    let live = true;
    loadAppFonts()
      .catch(() => { })
      .finally(() => {
        if (live) setFontsLoaded(true);
      });
    return () => {
      live = false;
    };
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SheetHostProvider>
          <SessionProvider>
            <RootNavigator />
          </SessionProvider>
        </SheetHostProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
