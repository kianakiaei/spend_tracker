// Sign-up (expo-mobile ticket 02): never signs in directly — the account
// stays unverified until the emailed link is opened (same as web).

import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";
import { useSession } from "../../src/session";
import { AuthButton, AuthErrorText, AuthField, AuthNote, AuthScreen } from "./_forms";

export default function SignUpScreen() {
  const { auth } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit() {
    setError(null);
    setNotice(null);
    setPending(true);
    try {
      const { needsVerification } = await auth.signUp({ email, password });
      if (needsVerification) {
        setNotice("حساب ساخته شد؛ پیوند تأیید را به ایمیلت فرستادیم — بازش کن تا وارد شوی");
        return;
      }
      router.replace("/(tabs)");
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthScreen title="ساخت حساب در دفتر هزینه">
      <AuthField label="ایمیل" value={email} onChangeText={setEmail} keyboard="email-address" />
      <AuthField label="رمز" value={password} onChangeText={setPassword} secure />
      <AuthErrorText error={error} />
      {notice && <AuthNote>{notice}</AuthNote>}
      <AuthButton title="ساخت حساب" onPress={onSubmit} pending={pending} />
      <Link href="/(auth)/sign-in">
        <Text>حساب داری؟ ورود</Text>
      </Link>
    </AuthScreen>
  );
}
