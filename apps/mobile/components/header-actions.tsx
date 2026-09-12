// Tabs header actions (expo-mobile ticket 10): a search shortcut plus the
// «…» menu. The More tab is gone — الگوها, بینش‌ها, and خروج live here in a
// lightweight popover (transparent Modal + dismiss overlay, no native-only
// dep, so it works identically on expo web). The stack screens keep the
// default back header; these actions sit on the tabs header only.

import { useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { T as Text } from "./app-text";
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

/** Tabs header «…» menu (headerRight, see module doc above). */
export function HeaderMenuAction() {
  const router = useRouter();
  const { auth, refreshSession } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  function go(path: "/templates" | "/insights") {
    setMenuOpen(false);
    router.push(path);
  }

  async function onSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await auth.signOut();
      await refreshSession();
      setMenuOpen(false);
      router.replace("/(auth)/sign-in");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <>
      <Pressable
        accessibilityLabel="منوی بیشتر"
        accessibilityRole="button"
        onPress={() => setMenuOpen(true)}
        style={iconButton}
      >
        <Ionicons name="ellipsis-horizontal" size={24} color="#1c1a17" />
      </Pressable>

      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable
          accessibilityLabel="بستن منو"
          onPress={() => setMenuOpen(false)}
          style={{
            flex: 1,
            backgroundColor: "rgba(28,26,23,0.35)",
            paddingTop: 8,
            paddingHorizontal: 12,
          }}
        >
          <View
            style={{
              backgroundColor: "#fffdf9",
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "#d8d3c8",
              overflow: "hidden",
            }}
          >
            <Pressable
              accessibilityLabel="الگوهای تکرار"
              onPress={() => go("/templates")}
              style={menuRow}
            >
              <Text style={menuText}>الگوهای تکرار</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="بینش محصول‌ها"
              onPress={() => go("/insights")}
              style={menuRow}
            >
              <Text style={menuText}>بینش محصول‌ها</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="خروج"
              onPress={() => void onSignOut()}
              disabled={signingOut}
              style={[menuRow, { borderBottomWidth: 0 }]}
            >
              <Text style={[menuText, { color: signingOut ? "#6b6259" : "#b3261e" }]}>
                {signingOut ? "…" : "خروج"}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const iconButton = {
  width: 38,
  height: 38,
  borderRadius: 19,
  alignItems: "center",
  justifyContent: "center",
} as const;

const menuRow = {
  paddingHorizontal: 20,
  paddingVertical: 14,
  borderBottomWidth: 1,
  borderBottomColor: "#e7e2d8",
  alignItems: "flex-end",
} as const;

const menuText = {
  fontSize: 15,
  fontWeight: "700",
  color: "#1c1a17",
} as const;
