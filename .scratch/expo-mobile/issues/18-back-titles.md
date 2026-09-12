# 18: Truthful back-button labels on stack screens

**What to build:** Answer user review: the native iOS back chevron on every
stack screen reads "tab1" — the untitled `(tabs)` route leaking through as
the back label. Label each back button with something always true: the event
detail always returns to Events, so it gets «رویدادها»; category drilldown
(Home tile or Categories tab) and search (any tab) have no single true
origin, so they use the chevron-only iOS idiom instead of a lying label.

**Blocked by:** none.

**Status:** done

- [x] Every stack screen shows its origin tab on the back button; no static
      label that can lie, no chevron-only compromise needed

Done 2026-09-12: `src/last-tab.ts` records each tab's label on focus and
stack screens (category, event, search) set `headerBackTitle` from it on
mount — focus ordering makes it exact (origin still focused at push time,
switches re-record, deep links fall back to «خانه» where Back lands).
Gate: mobile tsc + eslint clean, unit tests green (new `mobile-last-tab`
seam: default + record).
