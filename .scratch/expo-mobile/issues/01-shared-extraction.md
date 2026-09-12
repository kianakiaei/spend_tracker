# 01: Shared extraction with wire parity

**What to build:** Move the versioned API client wrapper, request/response shapes, Jalali calendar helpers, title normalization, and formatting helpers into one shared pure package consumed by both web and mobile, with the web re-imported and zero wire change.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Web behavior unchanged against the frozen versioned API contract (existing contract and integration coverage green)
- [x] Shared package has no web-only or native-only dependencies
- [x] Unit coverage for client wrapper with injected fetch, Jalali month derivation and shifting, normalization parity, and quantity/unit arithmetic

Done 2026-09-12: `packages/shared` (`@spend-tracker/shared`) holds the client, DTO shapes, Jalali, `canonical`, formatting, and quantity arithmetic verbatim; `src/lib/*` are one-line re-exports (object identity holds). Gate: `tests/unit/shared-parity.test.ts` (20 tests), full suite 443 passed, tsc/lint clean, shared coverage 100/100. Pre-existing `src/lib/services` branch-coverage gap (72.06 vs 80) unchanged from HEAD — out of scope.
