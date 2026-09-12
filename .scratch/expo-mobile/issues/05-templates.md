# 05: Templates and Template sheet

**What to build:** Recurring template management with pause/resume, jump to the generated expense of the month, three-month future preview, and the native Template bottom sheet for create/edit including backfill semantics.

**Blocked by:** 03-dashboard-expense-sheet.

**Status:** done

- [x] List shows active/paused state and whether this month was generated with a working jump
- [x] Preview covers three future months with clamped days
- [x] Sheet captures title, amount, day of month, category, start date, and optional end date

Done 2026-09-12: `apps/mobile/src/templates.ts` holds the pure core (list VM with «متوقف» badge + rhythm labels in Persian voice, generated-this-month jump map, 3-month horizon keys + preview sections filtered to the horizon, day/amount parsing, full-payload create/update, one-`active`-PATCH pause/resume) and `apps/mobile/src/template-queries.ts` the loader (list + categories + this month's ledger + events for the jump sheet + three previews) with prefix invalidation of templates/dashboard/categories/insights; `app/templates.tsx` (stack screen, linked from More) plus `components/template-sheet-form.tsx` wire them into the Expo shell with the universal bottom sheet. The generated jump opens the خرج inline in its edit sheet (mobile has no cross-screen `?expense=` deep-link) and invalidates on close. No server change. Frozen-API note: `events.list()` rides along in the loader for the jump sheet's attach (additive read, no contract change); generated-map last-wins and amount parsing match web parity verbatim. Gate: `tests/unit/mobile-templates.test.ts` (26 tests), full suite 553 passed, root + mobile tsc and eslint clean. Code-review fixes applied: horizon enforced in the core (out-of-window previews never render), create-sheet end-toggle default, jump-sheet invalidation on close, dropped unused list-VM param. Follow-ups (same as 03): custom Jalali date picker (sheet takes ISO text today), server field-level error mapping.
