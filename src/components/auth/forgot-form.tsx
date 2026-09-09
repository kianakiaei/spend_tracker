"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

const GENERIC_OK = "اگر این ایمیل ثبت شده باشد، لینک ریست فرستاده شد";
const NETWORK = "ارتباط با سرور برقرار نشد؛ دوباره تلاش کنید";

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setNote(null);
    setError(null);
    setPending(true);
    try {
      const { error } = await authClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password",
      });
      if (error) {
        setError(NETWORK);
        return;
      }
      setNote(GENERIC_OK);
    } catch {
      setError(NETWORK);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[400px] px-6 pb-10 pt-16">
      <h1 className="text-[22px] font-extrabold">فراموشی رمز</h1>
      <p className="mt-2 text-[13.5px] leading-7 text-ink-muted">
        ایمیل حسابت را بنویس؛ اگر ثبت شده باشد لینک ریست می‌فرستیم.
      </p>
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
            className="rounded-xl border border-rule bg-panel px-3 py-2 text-left text-[14.5px]"
          />
        </label>
        {error && (
          <p role="alert" className="text-[13.5px] text-danger">
            {error}
          </p>
        )}
        {note && (
          <p role="status" className="text-[13.5px] text-accent">
            {note}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="mt-1 rounded-xl bg-accent px-4 py-2.5 text-[14.5px] font-bold text-white disabled:opacity-60"
        >
          {pending ? "…" : "فرستادن لینک ریست"}
        </button>
      </form>
    </div>
  );
}
