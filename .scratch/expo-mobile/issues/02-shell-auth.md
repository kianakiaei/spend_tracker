# 02: Shell and auth on expo web

**What to build:** A runnable Expo Router shell with five bottom tabs plus stack drilldown routes, in-app sign-in/sign-up/forgot/reset, and a universal token store over a configurable API base URL, verified in a desktop browser via expo web.

**Blocked by:** 01-shared-extraction.

**Status:** done

- [x] Tabs for Home, Categories, Events, Search, and More with stack drilldowns resolve on native and expo web
- [x] Sign-in, sign-up, forgot, and reset complete against the existing auth mechanism with persistence across restarts and sign-out
- [x] Unverified email blocks with a clear message and resend path

Done 2026-09-12: `apps/mobile` (`@spend-tracker/mobile`, Expo SDK 57) holds the pure core (`src/config`, `src/token-store`, `src/auth-client`, `src/routes` — injected fetch/storage seams, zero native deps) plus the Expo Router shell (`app/(tabs)` x5, `app/category/[id]`, `app/event/[id]`, `app/(auth)` x4) wired through `src/session` (SecureStore/localStorage restore, shared v1 client over the Bearer supplier). No server change; `redirectTo` stays the same-origin web path (link interception is later work). Gate: `tests/unit/mobile-shell-auth.test.ts` (22 tests), full suite 467 passed, tsc/eslint clean. Follow-ups: field-level validation mapping, emailed-link deep-link routing.
