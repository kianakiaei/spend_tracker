import { useEffect, type RefObject } from "react";

// Focus a sheet's first field after a beat instead of autoFocus: the sheet's
// enter animation plus any toolbar dance settle first, so the keyboard opens
// against final geometry (the anchor in SheetPanel never sees a mid-flight
// viewport). Skipped entirely when the caller says so (edit sheets open
// keyboard-free), and never steals focus if the user already tapped
// somewhere within the delay. preventScroll keeps Safari from panning —
// the anchor owns positioning.
export function useDelayedFocus<T extends HTMLElement>(
  ref: RefObject<T | null>,
  enabled: boolean,
  delayMs = 1000,
) {
  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => {
      if (
        document.activeElement &&
        document.activeElement !== document.body
      ) {
        return;
      }
      ref.current?.focus({ preventScroll: true });
    }, delayMs);    return () => clearTimeout(timer);
  }, [enabled, delayMs, ref]);
}
