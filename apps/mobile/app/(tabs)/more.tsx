import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Button, Pressable, Text } from "react-native";
import { useSession } from "../../src/session";
import { ShellPanel } from "./_panel";

export default function MoreScreen() {
  const { auth, refreshSession } = useSession();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSignOut() {
    setPending(true);
    try {
      await auth.signOut();
      await refreshSession();
      router.replace("/(auth)/sign-in");
    } finally {
      setPending(false);
    }
  }

  return (
    <ShellPanel title="بیشتر">
      <Link href="/templates" asChild>
        <Pressable
          accessibilityLabel="الگوهای تکرار"
          style={{
            borderWidth: 1,
            borderColor: "#d8d3c8",
            borderRadius: 12,
            paddingHorizontal: 20,
            paddingVertical: 12,
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: "800", color: "#1a7a5c" }}>
            الگوهای تکرار
          </Text>
        </Pressable>
      </Link>
      <Link href="/insights" asChild>
        <Pressable
          accessibilityLabel="بینش محصول‌ها"
          style={{
            borderWidth: 1,
            borderColor: "#d8d3c8",
            borderRadius: 12,
            paddingHorizontal: 20,
            paddingVertical: 12,
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: "800", color: "#1a7a5c" }}>
            بینش محصول‌ها
          </Text>
        </Pressable>
      </Link>
      <Button title={pending ? "…" : "خروج"} onPress={onSignOut} disabled={pending} />
    </ShellPanel>
  );
}
