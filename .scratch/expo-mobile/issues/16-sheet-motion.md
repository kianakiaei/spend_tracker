# 16: Native-feel sheet motion + iOS RTL triage

**What to build:** Answer user review (2026-09-12, seventh round, angry):
(1) the bottom sheet feels IE6 — diagnosis confirmed: the native variant
wraps scrim + panel in one `slide` Modal animation, so the backdrop slides
up with the sheet. Rebuild with separated physics: fading scrim, spring
entry, grabber handle with drag-to-dismiss and snap-back. (2) RTL still
reported broken on iOS while web is fine — needs a device screenshot to
pinpoint; the T-wrapper fix (ticket 14) covers all RN text, so the remainder
is either a stale bundle or native chrome.

**Blocked by:** none.

**Status:** done (sheet); RTL half needs a device screenshot

- [x] Sheet: scrim fades, panel springs in, grabber drag-to-dismiss with
      velocity/offset dismiss vs snap-back, exit slide on dismiss
- [ ] iOS RTL: screenshot-driven follow-up (T fix already shipped)

Done 2026-09-12 (sheet): `AnimatedSheet` replaces both Modal variants —
scrim fades 200ms while the panel springs (damping 30 / stiffness 300), a
grabber handle owns a PanResponder (down-drag past 120pt or 0.9 velocity
dismisses with an exit slide, otherwise springs back), scrim tap and
back-button share the same animated dismiss. Gate: mobile tsc + eslint
clean, sheet unit seam untouched, web export bundles.
