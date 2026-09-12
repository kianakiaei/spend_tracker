# 11: Mobile form + chrome polish — icons, picker, Persian digits, sheet layer, tiles

**What to build:** Answer user review of the expo build (2026-09-12, second
round): tab buttons share one glyph, the header search is an emoji, the
header wants search-left + centered title, the date field is a dead ISO text
box on mobile, form numbers show Latin digits, the web sheet slides under
the tab bar, and home tiles lost the anchor sizing (largest used to go full
width first).

**Blocked by:** 10-shell-polish.

**Status:** done

- [x] Tab bar + header use proper theme icons (Ionicons via
      `@expo/vector-icons`, never emoji); header has search-left, centered
      title, «…»-right
- [x] Expense/Template sheets pick the occurrence date from a custom Jalali
      month grid (Gregorian ISO storage, Jalali display, unbounded months) —
      no third-party picker with single-platform lock-in
- [x] Amount/quantity fields display grouped Persian digits and accept
      Persian digits on input (fa→en parse already exists in the core)
- [x] Web sheet renders in a Modal portal above the tab bar
- [x] Home tiles mirror the web mosaic: largest full-width anchor, ≥25%
      full-width, rest half-width

Done 2026-09-12 in three commits: (1) Ionicons tab icons (home/grid/calendar
with focused states) + header search-left/centered-title/menu-right + web
sheet Modal portal + tile mosaic spans with dots; (2) `occurrenceISO` moved
verbatim to `@spend-tracker/shared/jalali` (recurring re-exports, zero server
change) + tested `jalali-picker` grid core + `JalaliDatePicker` month-grid
Modal; (3) `format/normalizeAmount|QuantityInput` core (web live fa-IR
parity, Persian display + Latin storage) wired into expense/template amount,
quantity, and day fields + picker wiring + `INPUT_FONT_STYLE` on all seven
input surfaces. Gate: full suite green, root + mobile tsc and eslint clean.
Note: the web sheet's old inline fixed-View variant is gone — both variants
are Modal portals behind the same `resolveSheetVariant` seam.

**Decisions:** `occurrenceISO` moves verbatim into
`@spend-tracker/shared` (web re-exports — the picker and the server share
one day-math); the picker is pure RN Views (expo-web safe) fed by the
shared Jalali core; amount display reuses the web's live fa-IR grouping
(`formatNumber`) with the core's fa→en parse untouched.
