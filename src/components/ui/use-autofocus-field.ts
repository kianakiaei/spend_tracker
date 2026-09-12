import { useCallback, useRef } from "react";

// Returns a callback ref that focuses the field on mount — create sheets on
// mobile only; edit sheets pass enabled=false and stay keyboard-free.
//
// A callback ref, deliberately not an effect: the fields mount inside
// Vaul's portal, which Radix mounts a beat AFTER the parent's effects run,
// so every effect (even layout) sees a null ref. The ref callback fires
// during commit, still inside the opening tap's user activation — which is
// what makes iOS open the keyboard at all. Any setTimeout lands outside
// that window: focused field, shut keyboard. Plain focus() lets Safari
// scroll the field into view inside the form's own scroll region; the
// sheet anchor owns the rest.
export function useAutofocusField<T extends HTMLElement>(enabled: boolean) {
  const done = useRef(false);
  return useCallback(
    (element: T | null) => {
      if (element === null || !enabled || done.current) return;
      const coarse =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(pointer: coarse)").matches;
      if (!coarse) return;
      done.current = true;
      element.focus();
    },
    [enabled],
  );
}
