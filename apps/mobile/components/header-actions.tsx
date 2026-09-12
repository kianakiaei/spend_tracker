// Tabs header actions (expo-mobile tickets 10–12): a search shortcut
// (headerLeft on every tab) and sign-out (headerRight on Home only, so stack
// screens keep a clean back header). The ticket-10 «…» menu is gone —
// templates and insights are tabs now. No native-only deps, so both actions
// work identically on expo web.

import { useState } from "react";
import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSession } from "../src/session";

/** Tabs header search shortcut (headerLeft): jumps to the search stack. */
export function HeaderSearchAction() {
  const router = useRouter();
  return (
    <Pressable
      accessibilityLabel="جست‌وجو"
      accessibilityRole="button"
      onPress={() => router.push("/search")}
      style={iconButton}
    >
      <Ionicons name="search" size={22} color="#1c1a17" />
    </Pressable>
  );
}

/** Home header sign-out (headerRight on the Home tab only). */
export function HeaderLogoutAction() {
  const router = useRouter();
  const { auth, refreshSession } = useSession();
  const [signingOut, setSigningOut] = useState(false);

  async function onSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await auth.signOut();
      await refreshSession();
      router.replace("/(auth)/sign-in");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <Pressable
      accessibilityLabel="خروج"
      accessibilityRole="button"
      onPress={() => void onSignOut()}
      disabled={signingOut}
      style={[iconButton, { opacity: signingOut ? 0.5 : 1 }]}
    >
      <Ionicons name="log-out-outline" size={22} color="#1c1a17" />
    </Pressable>
  );
}

const iconButton = {
  width: 38,
  height: 38,
  borderRadius: 19,
  alignItems: "center",
  justifyContent: "center",
} as const;
