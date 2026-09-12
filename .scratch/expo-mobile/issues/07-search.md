# 07: Search

**What to build:** Whole-ledger title search with the same Persian normalization the categorization engine uses, hit metadata, and tap-to-edit in the Expense sheet.

**Blocked by:** 03-dashboard-expense-sheet.

**Status:** done

- [x] Normalized queries match across digit, Yeh, and half-space variants
- [x] Each hit shows amount, Jalali occurrence month, and category
- [x] Tapping a hit opens the shared Expense edit sheet

Done 2026-09-12: `apps/mobile/src/search.ts` holds the pure core (canonical `narrowHits` mirroring the board's live filter, view-model rows with Persian-digit amount + وقوع month label + دسته/رویداد chips, `toSheetExpenseRef` with web `toSheetExpense` parity) and `apps/mobile/src/search-queries.ts` the loader (frozen `GET /api/v1/search?q=` per debounced keystroke — blank short-circuits to `[]` exactly like the server — plus categories/events for the sheet; no own invalidator, the expense-save fan-out already refreshes the `search` scope); `app/(tabs)/search.tsx` wires it into the Expo shell with a 300ms-debounced input, pull-to-refresh, and tap-to-edit in the shared Expense sheet (hit's own month captured at tap, never query text). No server change. Gate: `tests/unit/mobile-search.test.ts` (11 tests), full suite 594 passed, root + mobile tsc and eslint clean. Code-review fixes applied: hit-month captured at tap with current-month fallback, route naming untouched (tab already «جست‌وجو»). Follow-ups (same as 03/05/06): server field-level error mapping; screen interaction tests belong to ticket 09.
