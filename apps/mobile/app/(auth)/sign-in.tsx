// Sign-in (expo-mobile ticket 02): verified users in, unverified users get the
// clear block + resend path, everyone else the generic voice (no enumeration).

import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { MobileAuthError } from "../../src/auth-client";
import { useSession } from "../../src/session";
import { AuthButton, AuthErrorText, AuthField, AuthNote, AuthScreen } from "./_forms";

export default function SignInScreen() {
  const { auth, refreshSession } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  async function onSubmit() {
    setError(null);
    setResent(false);
    setPending(true);
    try {
      await auth.signIn({ email, password });
      await refreshSession();
      router.replace("/(tabs)");
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  }

  async function onResend() {
    setResending(true);
    try {
      await auth.resendVerification({ email });
      setResent(true);
    } finally {
      setResending(false);
    }
  }

  const unverified = error instanceof MobileAuthError && error.code === "unverified";

  return (
    <AuthScreen title="ورود به دفتر هزینه">
      <AuthField label="ایمیل" value={email} onChangeText={setEmail} keyboard="email-address" />
      <AuthField label="رمز" value={password} onChangeText={setPassword} secure />
      <AuthErrorText error={error} />
      {unverified && (
        <View style={{ gap: 8 }}>
          {resent ? (
            <AuthNote>پیوند تازه فرستاده شد؛ ایمیلت را باز کن.</AuthNote>
          ) : (
            <AuthButton
              title={resending ? "…" : "فرستادن دوبارهٔ پیوند تأیید"}
              onPress={onResend}
              pending={resending}
            />
          )}
        </View>
      )}
      <AuthButton title="ورود" onPress={onSubmit} pending={pending} />
      <Link href="/(auth)/sign-up">
        <Text>حساب نداری؟ ثبت‌نام</Text>
      </Link>
      <Link href="/(auth)/forgot">
        <Text>فراموشی رمز؟</Text>
      </Link>
    </AuthScreen>
  );
}
