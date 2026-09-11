import { useEffect, type RefObject } from "react";

// Focus a create sheet's first field shortly after opening — mobile only
// (coarse pointers), edit sheets stay keyboard-free. Two reasons for the
// shape: the sheet's enter animation settles first so the keyboard opens
// against final geometry, and ~500ms still rides the opening tap's user
// activation, which is what makes iOS actually open the keyboard for a
// programmatic focus (a longer delay lands outside it: focused field, no
// keyboard). Never steals focus if the user already tapped somewhere, and
// never fires after unmount. Plain focus() — Safari's own scroll-into-view
// targets the form's scroll region, which is what we want.
export function useDelayedFocus<T extends HTMLElement>(
  ref: RefObject<T | null>,
  enabled: boolean,
  delayMs = 500,
) {
  useEffect(() => {
    if (!enabled) return;
    const coarse =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches;
    if (!coarse) return;
    const timer = setTimeout(() => {
      if (
        document.activeElement &&
        document.activeElement !== document.body
      ) {
        return;
      }
      ref.current?.focus();
    }, delayMs);
    return () => clearTimeout(timer);
  }, [enabled, delayMs, ref]);
}
