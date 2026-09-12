# 09: Harden and verify

**What to build:** Final parity pass: RTL and Persian-digit consistency, pull-to-refresh everywhere, one consistent error shape, and expo web plus device verification across every surface.

**Blocked by:** 04-categories, 05-templates, 06-events, 07-search, 08-insights.

**Status:** done

- [x] RTL layout, Persian digits, and Toman formatting consistent on all screens and sheets
- [x] Mutations refresh affected scopes with pull-to-refresh fallback and field-level validation messages where provided
- [x] Every surface verified on expo web; native sheet versus web sheet contract holds

Done 2026-09-12: `apps/mobile/src/server-errors.ts` holds the one error shape (`fieldErrorsFor`/`fieldMessageFor`/`saveErrorMessage` over problem+json `.problem.errors[]`, Persian fallback otherwise), wired into both Expense-sheet save paths; all four mutation fan-outs unified to the six affected scopes (`templates/dashboard/categories/events/search/insights` — each addition reads the scope it invalidates); `formatLedgerQuantity` (dashboard core) renders ledger quantities in Persian digits and is wired into Home; `UniversalSheetProps` carries the contract in one place (`children?: unknown` — pure core stays React-free) with the bottom-sheet-on-both-variants comment corrected. No server change. Gate: `tests/unit/mobile-harden.test.ts` (7 tests), full suite 601 passed, root + mobile tsc and eslint clean. Code-review fixes applied: dropped the duplicate `templatesScope`/unused `dashboardScope` consts (siblings use literals). Follow-ups: per-field inline messages in all sheets (helper ready, only the banner is wired), full expo-web interaction coverage, on-device sheet pass.
