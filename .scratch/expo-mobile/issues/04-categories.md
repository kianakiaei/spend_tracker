# 04: Categories and drilldown

**What to build:** Full category management with usage counts, creation with color, rename including system categories, reordering, guarded deletion via move-expenses, and the drilldown with locked-category expense entry.

**Blocked by:** 03-dashboard-expense-sheet.

**Status:** done

- [x] List shows expense and template counts per category
- [x] System and populated categories refuse deletion with a clear error; move-expenses-then-delete preserves every expense
- [x] Drilldown panel plus locked-category add keeps context

Done 2026-09-12: `apps/mobile/src/categories.ts` holds the pure core (list VM sorted by order with usage labels + delete guard + drilldown links, create/rename validation + payloads, reorder plan + local swap, move-then-delete, drilldown panel) and `apps/mobile/src/category-queries.ts` the loaders + prefix invalidation; `app/(tabs)/categories.tsx` and `app/category/[id].tsx` wire them into the Expo shell with the locked-category Expense sheet. No server change. Frozen-API note: خرج counts are this month's (summary byCategory, labelled as such with Persian digits — no all-time GROUP-BY endpoint exists) and الگو counts are all-time grouped client-side. Gate: `tests/unit/mobile-categories.test.ts` (28 tests), full suite 527 passed, root + mobile tsc and eslint clean. Code-review fixes applied: Persian-digit counts, visible deleteHint under guarded rows, honest month-scoped labels (never a false «خالی» — server 409 still guards all-time-populated deletes), forecast rows gated to future months in the core, dead local-swap call removed (refetch carries the true order).
