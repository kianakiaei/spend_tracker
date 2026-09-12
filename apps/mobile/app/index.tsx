// Welcome landing (expo-mobile tickets 02 + 13): the root `/` screen.
// Signed-out users get the ledger-paper hero — coin medallion, oversized
// title, one-line pitch, primary ورود pill, quiet signup path. Signed-in
// users bounce straight into the tab shell. Declared first in the root
// Stack so the initial route can never fall through to reset again.

import { Link, Redirect } from "expo-router";
import { Pressable, View } from "react-native";
import { T as Text } from "../components/app-text";
import { WELCOME_ROUTE } from "../src/routes";
import { useSession } from "../src/session";
import { AuthMedallion } from "./(auth)/_forms";

export default function WelcomeScreen() {
  const { session } = useSession();
  if (session) return <Redirect href="/(tabs)" />;
  return (
    <View
      accessibilityLabel={WELCOME_ROUTE}
      style={{
        flex: 1,
        direction: "rtl",
        backgroundColor: "#fffdf9",
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
        gap: 14,
      }}
    >
      <AuthMedallion size={112} />
      <View style={{ gap: 6, alignItems: "center" }}>
        <Text style={{ fontSize: 34, fontWeight: "800" }}>دفتر هزینه</Text>
        <Text style={{ fontSize: 14, color: "#6b6259", textAlign: "center", lineHeight: 26 }}>
          خرج‌های ماه را به تومان دنبال کن؛ با دسته‌بندی فارسی و پیش‌بینی الگوها.
        </Text>
      </View>
      <Link href="/(auth)/sign-in" asChild>
        <Pressable
          accessibilityLabel="ورود"
          accessibilityRole="button"
          style={{
            backgroundColor: "#1a7a5c",
            borderRadius: 999,
            paddingHorizontal: 64,
            paddingVertical: 13,
            minHeight: 50,
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>ورود</Text>
        </Pressable>
      </Link>
      <Link href="/(auth)/sign-up" asChild>
        <Pressable accessibilityLabel="ثبت‌نام" accessibilityRole="link">
          <Text style={{ fontSize: 14, color: "#1a7a5c", fontWeight: "800" }}>
            حساب نداری؟ ثبت‌نام
          </Text>
        </Pressable>
      </Link>
      <Text style={{ fontSize: 12, color: "#6b6259", textAlign: "center", marginTop: 8 }}>
        دسته‌بندی فارسی · پیش‌بینی الگوها · تقویم جلالی
      </Text>
      {/* Temporary bundle fingerprint for device triage (ticket 16):
          proves which commit the phone is running. Remove afterwards. */}
      <Text style={{ fontSize: 10, color: "#b9b2a6", textAlign: "center" }}>
        ساخت static-1
      </Text>
    </View>
  );
}
