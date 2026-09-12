# 02: Shell and auth on expo web

**What to build:** A runnable Expo Router shell with five bottom tabs plus stack drilldown routes, in-app sign-in/sign-up/forgot/reset, and a universal token store over a configurable API base URL, verified in a desktop browser via expo web.

**Blocked by:** 01-shared-extraction.

**Status:** ready-for-agent

- [ ] Tabs for Home, Categories, Events, Search, and More with stack drilldowns resolve on native and expo web
- [ ] Sign-in, sign-up, forgot, and reset complete against the existing auth mechanism with persistence across restarts and sign-out
- [ ] Unverified email blocks with a clear message and resend path
