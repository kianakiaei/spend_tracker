# 06: Events and detail

**What to build:** Event buckets as a second layer over categorized monthly expenses: list with totals, create/rename, detail with locked-event entry, and unlink-only deletion.

**Blocked by:** 03-dashboard-expense-sheet.

**Status:** done
Done 2026-09-12: `apps/mobile/src/events.ts` holds the pure core (list VM in
server order with this-month total + count overlay in Persian voice,
trimmed create (title + optional note) / title-only rename payloads,
detail panel with locked-event id, one-DELETE unlink-only removal) and
`apps/mobile/src/event-queries.ts` the loaders + prefix invalidation;
`app/(tabs)/events.tsx` and `app/event/[id].tsx` wire them into the Expo
shell with the locked-event Expense sheet, unbounded month navigator, and
edit-from-row. No server change. Frozen-API note: totals are month-scoped
(this month's ledger grouped client-side, labelled «در این ماه» — the
ticket-04 precedent; the API exposes no event-summary/event-expenses read)
and forecast rows never enter event totals. Gate:
`tests/unit/mobile-events.test.ts` (19 tests), full suite 572 passed, root
+ mobile tsc and eslint clean. Code-review fixes applied: split list/detail
loaders (list skips the unrendered categories fetch), one-pass grouping +
shared total helper, sibling-parity `run(fn, message)`, shared
`EventDetailPanel` type, local `refresh()`. Follow-ups (same as 03/05):
server field-level error mapping; all-time event history needs a new
frozen-API read (out of scope).

- [x] List shows total plus count per event; detail shows its panel
- [x] Every expense in an event keeps its own category and occurrence month
- [x] Deleting an event unlinks only and never deletes expenses, behind a confirm
