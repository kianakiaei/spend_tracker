// Forgot password (expo-mobile ticket 02): always answers generically
// (anti-enumeration, like the web forgot form).

import { useState } from "react";
import { useSession } from "../../src/session";
import { AuthButton, AuthErrorText, AuthField, AuthNote, AuthScreen } from "./_forms";

export default function ForgotScreen() {
  const { auth } = useSession();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit() {
    setError(null);
    setNote(null);
    setPending(true);
    try {
      await auth.requestPasswordReset({ email });
      setNote("اگر این ایمیل ثبت شده باشد، لینک ریست فرستاده شد");
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthScreen title="فراموشی رمز" subtitle="ایمیلت را بزن؛ اگر ثبت شده باشد لینک ریست می‌فرستیم.">
      <AuthField
        label="ایمیل"
        value={email}
        onChangeText={setEmail}
        keyboard="email-address"
        autoFocus
        disabled={pending}
        returnKeyType="done"
        textContentType="username"
        onSubmitEditing={() => void onSubmit()}
      />
      <AuthErrorText error={error} />
      {note && <AuthNote>{note}</AuthNote>}
      <AuthButton title="فرستادن لینک ریست" onPress={onSubmit} pending={pending} />
    </AuthScreen>
  );
}
