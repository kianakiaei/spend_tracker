# 01: Shared extraction with wire parity

**What to build:** Move the versioned API client wrapper, request/response shapes, Jalali calendar helpers, title normalization, and formatting helpers into one shared pure package consumed by both web and mobile, with the web re-imported and zero wire change.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Web behavior unchanged against the frozen versioned API contract (existing contract and integration coverage green)
- [ ] Shared package has no web-only or native-only dependencies
- [ ] Unit coverage for client wrapper with injected fetch, Jalali month derivation and shifting, normalization parity, and quantity/unit arithmetic
