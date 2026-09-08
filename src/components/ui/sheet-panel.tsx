"use client";

import { useEffect, type ReactNode } from "react";

// The bottom-sheet chrome every form in the app rises in (ticket 27's
// anatomy, shared with ticket 28's template sheet): a scrim fading in over
// a frozen page and a panel rising from the bottom edge — gone entirely
// under prefers-reduced-motion. Escape closes; the page behind never
// scrolls while the sheet is open.

export function SheetPanel({
  onClose,
  labelledBy,
  children,
}: {
  onClose: () => void;
  labelledBy?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className="animate-scrim-in fixed inset-0 z-40 bg-ink/30"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="animate-sheet-in fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[84dvh] w-full max-w-[680px] overflow-auto rounded-t-[20px] bg-panel px-6 pb-7 pt-5 shadow-[0_-14px_44px_rgba(32,36,31,0.2)]"
      >
        {children}
      </div>
    </>
  );
}
