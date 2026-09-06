"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { shiftJalaliMonthKey } from "@/lib/jalali";

// Month navigation (ticket 26): UNBOUNDED in both directions — the arrows
// rewrite ?month= and the server re-renders around it; past and future are
// both legitimate views (the future carries the forecast, decision 15).
// The month label is computed on the server and passed in — this component
// only shifts the key and pushes the URL.

export function MonthNav({
  monthKey,
  label,
}: {
  monthKey: string;
  label: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function go(delta: number) {
    const next = shiftJalaliMonthKey(monthKey, delta);
    startTransition(() => router.push(`/?month=${next}`));
  }

  return (
    <nav
      aria-label="ناوبری ماه"
      aria-busy={pending || undefined}
      className="flex items-center gap-0.5"
    >
      <button
        type="button"
        onClick={() => go(-1)}
        aria-label="ماه قبل"
        className="grid size-[34px] place-items-center rounded-full text-[17px] text-ink hover:bg-accent-soft"
      >
        ‹
      </button>
      <span className="min-w-28 text-center text-[15px] font-semibold">
        {label}
      </span>
      <button
        type="button"
        onClick={() => go(1)}
        aria-label="ماه بعد"
        className="grid size-[34px] place-items-center rounded-full text-[17px] text-ink hover:bg-accent-soft"
      >
        ›
      </button>
    </nav>
  );
}
