# 03: Dashboard and Expense sheet tracer

**What to build:** The core daily loop: Jalali month navigation with totals plus forecast, per-category tiles, the interleaved recorded-plus-forecast ledger, and the native Expense bottom sheet for create/edit/save-and-new/delete with suggestion badge and quantity/unit support.

**Blocked by:** 02-shell-auth.

**Status:** done

- [x] Month navigator is unbounded with totals, forecast total, and forecast rows badged as estimates, recorded first on day ties
- [x] Expense sheet captures title, whole-Toman amount, quantity plus unit, mandatory occurrence date with month derived from it, category, and optional event
- [x] Category suggestion shows its badge, stays freely changeable, and honors the repeat-generated notice and locked category/event entry points
- [x] Tapping a ledger row opens edit; delete asks inline confirm; lists refresh without restart

Done 2026-09-12: `apps/mobile/src` holds the pure core (`dashboard` view model + unbounded month shift, `expense-sheet` form state/validation/payloads/suggestion/delete over the typed v1 client, `sheet` universal variant, `queries` per-month loader + invalidation scopes over `@tanstack/react-query`); `apps/mobile/components` (universal sheet + expense form) and `app/(tabs)/index.tsx` wire it into the Expo shell with pull-to-refresh, FAB, and tile drilldowns. No server change. Gate: `tests/unit/mobile-dashboard-expense-sheet.test.ts` (32 tests), full suite 499 passed, root + mobile tsc and eslint clean. Follow-ups: custom Jalali date picker (sheet takes ISO text today), server field-level error mapping, frequency-based fallback (no frozen-API source — `/classify` fallback stands in).
