"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();

  async function onClick() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-rule px-3 py-1 text-[12.5px] text-ink-muted hover:text-ink"
    >
      خروج
    </button>
  );
}
