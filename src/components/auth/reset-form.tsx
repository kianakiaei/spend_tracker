"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

const INVALID = "این لینک معتبر نیست یا منقضی شده؛ یک لینک تازه بگیر.";
const NETWORK = "ارتباط با سرور برقرار نشد؛ دوباره تلاش کنید";

export function ResetForm({
  token,
  invalidLink,
}: {
  token?: string;
  invalidLink?: boolean;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    !token || invalidLink ? INVALID : null,
  );
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!token) return;
    setError(null);
    setPending(true);
    try {
      const { error } = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (error) {
        setError(INVALID);
        return;
      }
      router.push("/login?reset=done");
      router.refresh();
    } catch {
      setError(NETWORK);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[400px] px-6 pb-10 pt-16">
      <h1 className="text-[22px] font-extrabold">تعیین رمز تازه</h1>
      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-[13.5px]">
          <span className="font-semibold">رمز تازه</span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
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
          disabled={pending || !token}
          className="mt-1 rounded-xl bg-accent px-4 py-2.5 text-[14.5px] font-bold text-white disabled:opacity-60"
        >
          {pending ? "…" : "ثبت رمز تازه"}
        </button>
      </form>
    </div>
  );
}
