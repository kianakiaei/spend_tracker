"use client";

import { useEffect, type ReactNode } from "react";
import { Drawer } from "vaul";

// The bottom-sheet chrome every form in the app rises in (ticket 27's
// anatomy, shared with ticket 28's template sheet): a Vaul drawer —
// drag-to-dismiss with a grab pill, overlay tap and Escape all landing on
// onClose — over a frozen page. Gone entirely under
// prefers-reduced-motion (globals.css mutes Vaul's injected keyframes).
//
// Deliberately non-modal: the sheets embed react-multi-date-picker with
// `portal` (its calendar renders at document.body to escape the sheet's
// interior scroll region — see the date-picker smoke test). A modal drawer
// would pointer-lock and aria-hide that calendar and dismiss the sheet on
// the calendar's pointerdown. Non-modal keeps the calendar fully working
// with no coupling to the picker's internals, and matches the previous
// hand-rolled sheet, which never trapped focus either.
//
// Scroll lock stays a one-line body freeze: with `scrollbar-gutter: stable`
// on <html> (globals.css) hiding the page scrollbar no longer reflows the
// layout — the visible jump the old sheet had on open and close.

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
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <Drawer.Root
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      modal={false}
      dismissible
      direction="bottom"
    >
      <Drawer.Portal>
        <Drawer.Overlay
          onClick={onClose}
          className="fixed inset-0 z-40 bg-ink/30"
        />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[84dvh] w-full max-w-[680px] flex-col rounded-t-[20px] bg-panel shadow-[0_-14px_44px_rgba(32,36,31,0.2)] outline-none">
          {/* The native affordance: Vaul drags from anywhere on the panel
              (handleOnly is off), this pill just says so. */}
          <div
            aria-hidden
            className="mx-auto mb-1 mt-3 h-1.5 w-12 shrink-0 rounded-full bg-rule-strong"
          />
          <div className="sheet-panel-scroll min-h-0 flex-1 overflow-y-auto px-6 pb-7 pt-2 overscroll-contain">
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
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
