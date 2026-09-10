"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

type Mode = "sign-in" | "sign-up";

const GENERIC = "ایمیل یا رمز اشتباه است";
const UNVERIFIED = "ایمیلت هنوز تأیید نشده؛ پیوندی که موقع ثبت‌نام فرستادیم را باز کن";
const VERIFY_SENT =
  "حساب ساخته شد؛ پیوند تأیید را به ایمیلت فرستادیم — بازش کن تا وارد شوی";
const NETWORK = "ارتباط با سرور برقرار نشد؛ دوباره تلاش کنید";

export function LoginForm({ resetDone }: { resetDone?: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setPending(true);
    try {
      if (mode === "sign-in") {
        const { error } = await authClient.signIn.email({ email, password });
        if (error) {
          setError(
            (error as { code?: string }).code === "EMAIL_NOT_VERIFIED"
              ? UNVERIFIED
              : GENERIC,
          );
          return;
        }
      } else {
        const { data, error } = await authClient.signUp.email({
          email,
          password,
          name: email.split("@")[0] || email,
        });
        if (error) {
          setError(GENERIC);
          return;
        }
        // Signup never signs in now (verification required): a null token
        // means "check your email" — including the duplicate-email case,
        // which deliberately answers the same way (no enumeration).
        if (!data?.token) {
          setNotice(VERIFY_SENT);
          return;
        }
      }
      router.push("/");
      router.refresh();
    } catch {
      setError(NETWORK);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[400px] px-6 pb-10 pt-16">
      <h1 className="text-[22px] font-extrabold">
        {mode === "sign-in" ? "ورود به دفتر هزینه" : "ساخت حساب در دفتر هزینه"}
      </h1>
      {resetDone && (
        <p role="status" className="mt-2 text-[13.5px] text-accent">
          رمز تازه ثبت شد؛ حالا وارد شو.
        </p>
      )}
      {notice && (
        <p role="status" className="mt-2 text-[13.5px] leading-7 text-accent">
          {notice}
        </p>
      )}
      <div className="mt-4 flex gap-2" role="group" aria-label="نوع ورود">
        <button
          type="button"
          onClick={() => {
            setMode("sign-in");
            setError(null);
            setNotice(null);
          }}
          aria-pressed={mode === "sign-in"}
          className={
            mode === "sign-in"
              ? "rounded-full bg-ink px-4 py-1.5 text-[13.5px] font-semibold text-paper"
              : "rounded-full border border-rule px-4 py-1.5 text-[13.5px] text-ink-muted"
          }
        >
          ورود
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("sign-up");
            setError(null);
            setNotice(null);
          }}
          aria-pressed={mode === "sign-up"}
          className={
            mode === "sign-up"
              ? "rounded-full bg-ink px-4 py-1.5 text-[13.5px] font-semibold text-paper"
              : "rounded-full border border-rule px-4 py-1.5 text-[13.5px] text-ink-muted"
          }
        >
          ثبت‌نام
        </button>
      </div>
      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-[13.5px]">
          <span className="font-semibold">ایمیل</span>
          <input
            type="email"
            required
            autoComplete="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border border-rule bg-panel px-3 py-2 text-left text-[16px]"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[13.5px]">
          <span className="font-semibold">رمز</span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl border border-rule bg-panel px-3 py-2 text-left text-[16px]"
          />
        </label>
        {error && (
          <p role="alert" className="text-[13.5px] text-danger">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="mt-1 rounded-xl bg-accent px-4 py-2.5 text-[14.5px] font-bold text-white disabled:opacity-60"
        >
          {pending ? "…" : mode === "sign-in" ? "ورود" : "ساخت حساب"}
        </button>
      </form>
      <Link
        href="/forgot-password"
        className="mt-4 inline-block text-[13.5px] text-accent"
      >
        فراموشی رمز؟
      </Link>
    </div>
  );
}
