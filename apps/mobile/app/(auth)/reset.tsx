// Reset password (expo-mobile ticket 02): consumes ?token= from the emailed
// link; a bad/expired token gets the invalid-link voice with a fresh-link path.

import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { MOBILE_AUTH_MESSAGES, MobileAuthError } from "../../src/auth-client";
import { useSession } from "../../src/session";
import { AuthButton, AuthErrorText, AuthField, AuthScreen } from "./_forms";

export default function ResetScreen() {
  const { auth } = useSession();
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(
    !token ? new MobileAuthError("invalid-token", MOBILE_AUTH_MESSAGES["invalid-token"]) : null,
  );
  const [pending, setPending] = useState(false);

  async function onSubmit() {
    if (!token) return;
    setError(null);
    setPending(true);
    try {
      await auth.resetPassword({ newPassword: password, token });
      router.replace("/(auth)/sign-in");
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthScreen title="رمز تازه" subtitle="رمز تازه‌ات را بنویس تا حسابت باز شود.">
      <AuthField
        label="رمز تازه"
        value={password}
        onChangeText={setPassword}
        secure
        autoFocus
        disabled={pending || !token}
        returnKeyType="done"
        textContentType="newPassword"
        onSubmitEditing={() => void onSubmit()}
      />
      <AuthErrorText error={error} />
      <AuthButton title="ثبت رمز تازه" onPress={onSubmit} pending={pending} disabled={!token} />
    </AuthScreen>
  );
}
