// Welcome landing (expo-mobile ticket 02 follow-up): the root `/` screen.
// Signed-out users get a one-line intro with login and signup links;
// signed-in users bounce straight into the tab shell. Declared first in the
// root Stack so the initial route can never fall through to reset again.

import { Link, Redirect } from "expo-router";
import { Pressable, View } from "react-native";
import { T as Text } from "../components/app-text";
import { WELCOME_ROUTE } from "../src/routes";
import { useSession } from "../src/session";

export default function WelcomeScreen() {
  const { session } = useSession();
  if (session) return <Redirect href="/(tabs)" />;
  return (
    <View
      accessibilityLabel={WELCOME_ROUTE}
      style={{
        flex: 1,
        direction: "rtl",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        gap: 12,
      }}
    >
      <Text style={{ fontSize: 28, fontWeight: "800" }}>دفتر هزینه</Text>
      <Text style={{ fontSize: 14, color: "#6b6259", textAlign: "center" }}>
        خرج‌های ماه را به تومان دنبال کن؛ با دسته‌بندی فارسی و پیش‌بینی الگوها.
      </Text>
      <Link href="/(auth)/sign-in" asChild>
        <Pressable
          accessibilityLabel="ورود"
          style={{
            backgroundColor: "#1a7a5c",
            borderRadius: 999,
            paddingHorizontal: 48,
            paddingVertical: 12,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>ورود</Text>
        </Pressable>
      </Link>
      <Link href="/(auth)/sign-up" asChild>
        <Pressable accessibilityLabel="ثبت‌نام">
          <Text style={{ fontSize: 14, color: "#1a7a5c", fontWeight: "800" }}>
            حساب نداری؟ ثبت‌نام
          </Text>
        </Pressable>
      </Link>
    </View>
  );
}
