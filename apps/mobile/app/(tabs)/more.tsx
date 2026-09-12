import { useRouter } from "expo-router";
import { useState } from "react";
import { Button } from "react-native";
import { useSession } from "../../src/session";
import { ShellNote, ShellPanel } from "./_panel";

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
      <ShellNote>الگوها و بینش‌ها در تیکت‌های 05 و 08 می‌آیند.</ShellNote>
      <Button title={pending ? "…" : "خروج"} onPress={onSignOut} disabled={pending} />
    </ShellPanel>
  );
}
