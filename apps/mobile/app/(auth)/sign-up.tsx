// Sign-up (expo-mobile ticket 02): never signs in directly — the account
// stays unverified until the emailed link is opened (same as web).

import { useRouter } from "expo-router";
import { useState } from "react";
import { useSession } from "../../src/session";
import {
  AuthButton,
  AuthErrorText,
  AuthField,
  AuthLink,
  AuthNote,
  AuthScreen,
} from "./_forms";

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
    <AuthScreen title="ساخت حساب" subtitle="یک حساب بساز؛ پیوند تأیید به ایمیلت می‌آید.">
      <AuthField
        label="ایمیل"
        value={email}
        onChangeText={setEmail}
        keyboard="email-address"
        autoFocus
        disabled={pending}
        returnKeyType="next"
        textContentType="username"
      />
      <AuthField
        label="رمز"
        value={password}
        onChangeText={setPassword}
        secure
        disabled={pending}
        returnKeyType="done"
        textContentType="newPassword"
        onSubmitEditing={() => void onSubmit()}
      />
      <AuthErrorText error={error} />
      {notice && <AuthNote>{notice}</AuthNote>}
      <AuthButton title="ساخت حساب" onPress={onSubmit} pending={pending} />
      <AuthLink href="/(auth)/sign-in">حساب داری؟ وارد شو</AuthLink>
    </AuthScreen>
  );
}
