"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Drawer } from "vaul";

// The bottom-sheet chrome every form in the app rises in (ticket 27's
// anatomy, shared with ticket 28's template sheet): a Vaul drawer —
// drag-to-dismiss from the header, overlay tap and Escape all landing on
// onClose — over a frozen page. Gone entirely under
// prefers-reduced-motion (globals.css mutes Vaul's injected keyframes).
//
// Two deliberate departures from Vaul's defaults, both learned on iPhones:
//
// 1. The form scrolls natively and never drags (`data-vaul-no-drag`).
//    Vaul's dismiss gesture starts on any pointerdown, so a fast flick
//    through a long form — or any downward swipe from near the top —
//    sailed past the 25% close threshold and threw the sheet (and the
//    half-filled form) away. Only the fixed header drags now; the form
//    is pure scroll. Overlay tap and انصراف still dismiss.
//
// 2. Non-modal plus Vaul's own keyboard math OFF (`modal={false}`,
//    `repositionInputs={false}`), with one small listener of ours instead.
//    The sheets embed react-multi-date-picker with `portal` (its calendar
//    renders at document.body to escape the interior scroll region — see
//    the date-picker smoke test), which a modal drawer would pointer-lock,
//    aria-hide, and dismiss on. And Vaul's keyboard repositioning mixes
//    inline height AND bottom offsets from readings that iOS Chrome's
//    toolbar shifts corrupt — the stuck white gap above the keyboard. A
//    bottom-only lift of ours had the same disease from the other side: it
//    ignored Safari's viewport pan, so lift plus pan stacked and shoved the
//    title off-screen. What works is pinning the panel to the visual
//    viewport itself (pan offset included) while typing, and handing
//    geometry back to CSS the moment the keyboard closes.
//
// Scroll lock stays a one-line body freeze: with `scrollbar-gutter: stable`
// on <html> (globals.css) hiding the page scrollbar no longer reflows the
// layout — the visible jump the old sheet had on open and close.

/** visualViewport shrinks from toolbars too — only treat 60px+ as keyboard. */
const KEYBOARD_THRESHOLD_PX = 60;

function isTextEntry(element: Element | null): boolean {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement ||
    (element instanceof HTMLElement && element.isContentEditable)
  );
}

export function SheetPanel({
  onClose,
  title,
  description,
  children,
}: {
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // Keyboard anchor: while a text control inside the sheet holds focus and
  // the keyboard is open, pin the panel to the visual viewport — flush
  // above the keyboard, following Safari's pan via offsetTop — so the
  // focused field scrolls into view inside the form instead of the whole
  // page shifting and stranding a gap. Short sheets keep their size and
  // dock to the keyboard's top edge; tall ones fill what remains. The
  // moment the keyboard closes, all inline geometry is cleared and the
  // CSS bottom-0 sheet is back. Focus landing on a button while the
  // keyboard is still up keeps the last anchor (no flicker); the viewport
  // settling clears it.
  useEffect(() => {
    if (!window.visualViewport) return;
    // Narrowed once — the nested update() below can't reuse the guard.
    const viewport: VisualViewport = window.visualViewport;
    // Natural panel height while CSS owns the geometry; the anchor never
    // grows past it, so short sheets stay sheets instead of going fullscreen.
    let naturalHeight: number | null = null;
    function update() {
      const panel = contentRef.current;
      if (!panel) return;
      const keyboardHeight = window.innerHeight - viewport.height;
      const keyboardOpen = keyboardHeight > KEYBOARD_THRESHOLD_PX;
      const typing =
        keyboardOpen &&
        panel.contains(document.activeElement) &&
        isTextEntry(document.activeElement);
      if (typing) {
        const height = Math.min(
          naturalHeight ?? panel.offsetHeight,
          viewport.height,
        );
        panel.style.bottom = "";
        panel.style.height = `${Math.round(height)}px`;
        panel.style.top = `${Math.round(viewport.offsetTop + viewport.height - height)}px`;
      } else if (!keyboardOpen) {
        panel.style.top = "";
        panel.style.height = "";
        panel.style.bottom = "";
        naturalHeight = panel.offsetHeight;
      }
    }
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
    };
  }, []);

  return (
    <Drawer.Root
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      modal={false}
      repositionInputs={false}
      dismissible
      direction="bottom"
    >
      <Drawer.Portal>
        <Drawer.Overlay
          onClick={onClose}
          className="fixed inset-0 z-40 bg-ink/30"
        />
        <Drawer.Content
          ref={contentRef}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[84dvh] w-full max-w-[680px] flex-col rounded-t-[20px] bg-panel shadow-[0_-14px_44px_rgba(32,36,31,0.2)] outline-none"
        >
          {/* Fixed header: the title never scrolls away on long forms, and
              this strip is the drawer's only drag surface. */}
          <div className="shrink-0 px-6 pt-3">
            <div
              aria-hidden
              className="mx-auto mb-1 h-1.5 w-12 rounded-full bg-rule-strong"
            />
            <Drawer.Title asChild>
              <h2 className="text-[17px] font-bold">{title}</h2>
            </Drawer.Title>
            {description !== undefined && (
              <Drawer.Description asChild>
                <p
                  aria-live="polite"
                  className="mt-0.5 text-[13px] text-ink-muted"
                >
                  {description}
                </p>
              </Drawer.Description>
            )}
          </div>
          <div
            data-vaul-no-drag
            className="sheet-panel-scroll min-h-0 flex-1 overflow-y-auto px-6 pb-7 pt-2 overscroll-contain"
          >
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
