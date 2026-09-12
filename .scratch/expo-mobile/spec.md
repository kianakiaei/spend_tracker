# Spec: Expo mobile app with feature parity

Status: ready-for-agent

## Problem Statement

As a user of the monthly expense tracker, I can only manage my خرج‌ها، دسته‌ها، الگوهای تکرار، رویدادها، جست‌وجو and insights from the Next.js web UI. On my phone there is no mobile-shaped experience: no bottom tabs, no native-feeling bottom sheets for rapid expense entry, no mobile navigation for drilldowns. I want the same capabilities on iOS, Android, and expo web without learning a second domain language or losing Jalali-month behavior.

## Solution

Ship a minimal pnpm monorepo addition: an Expo Router mobile app plus one shared pure TypeScript package. The mobile app offers the same 7 web surfaces restyled for mobile (Dashboard, Categories + drilldown, Templates, Events + detail, Search, Insights), the same domain rules (ماهِ وقوع derived from occurrence date, پیش‌بینی display-only for future months, پیشنهاد with badge, normalized Persian search, تومان + Persian digits, RTL), and native bottom sheets for Expense and Template entry. It talks only to the existing frozen versioned HTTP API with bearer auth, and every Expo dependency used runs on expo web so the app is testable in a browser.

## User Stories

### Auth

1. As a new user, I want to sign up from the mobile app with email and password, so that I get the same seeded دسته‌های سیستمی as on web.
2. As a returning user, I want to sign in from the mobile app with email and password, so that I see only my own data.
3. As an unverified user, I want to be blocked with a clear message when my email is not verified and get a resend option, so that I understand why sign-in fails.
4. As a user who forgot their password, I want to request a reset and set a new password from the mobile app, so that I recover access without the web.
5. As a signed-in user, I want to stay signed in across restarts and sign out from the More area, so that daily entry is frictionless yet revocable.

### App shell and navigation

6. As a mobile user, I want bottom tabs for Home, Categories, Events, Templates, and Insights with a native header on every screen, so that I reach every area with one thumb. (Amended by tickets 10–12 per user reviews 2026-09-12: Search moved from a tab into a header action as a stack screen; the More tab is gone; logout lives header-right on Home only so stack screens keep a clean back header.)
7. As a mobile user, I want category and event drilldowns to push as stack screens with back navigation, so that I keep context of where I came from.
8. As a mobile user, I want a prominent add action on the Dashboard for a new خرج, so that capture takes seconds.
9. As a mobile user, I want the same app to load in a desktop browser via expo web, so that behavior can be tested without a phone.
10. As an RTL Persian user, I want the whole mobile app right-to-left with Persian digits and تومان formatting, so that it reads like the web.

### Dashboard (ماهِ وقوع + پیش‌بینی + ledger)

11. As a user, I want to see the current Jalali month total plus the forecast total on the Dashboard, so that I know spent vs coming.
12. As a user, I want per-دسته tiles sized by share that link to the category drilldown, so that I spot heavy spending.
13. As a user, I want an unbounded Jalali month navigator, so that I browse any past or future month.
14. As a user, I want a ledger of recorded خرج‌ها interleaved with پیش‌بینی rows on Jalali day (recorded first on ties), each forecast row badged as پیش‌بینی, so that future months read as estimates.
15. As a user, I want pull-to-refresh on the Dashboard, so that I recover from network hiccups.
16. As a user, I want tapping a ledger row to open the Expense sheet in edit mode, so that corrections are one tap away.

### Expense sheet (native bottom sheet)

17. As a user, I want to create a خرج with عنوان، مبلغ صحیح تومان، تعداد + واحد (عدد / کیلو)، تاریخ وقوع، دسته and optional رویداد, so that every web field is available on mobile.
18. As a user, I want date entry to be mandatory with the month of the ledger always derived from the occurrence date, so that there is never an undated خرج.
19. As a user, I want a دسته پیشنهاد with a visible badge while typing a title, freely changeable, falling back to my most frequent دسته when the engine has no guess, so that entry is fast but never forced.
20. As a user, I want to save, save-and-new, cancel, and delete (with inline confirm) from the Expense sheet, so that rapid entry and cleanup both work.
21. As a user, I want a notice when a خرج was generated from an الگوی تکرار, so that I know it is independent and freely editable.
22. As a user, I want to pre-lock the دسته when adding from a category drilldown and pre-lock the رویداد when adding from an event detail, so that context is preserved.

### Categories (دسته / دستهٔ سیستمی / دستهٔ سفارشی)

23. As a user, I want a categories list with خرج and template counts, so that I see usage at a glance.
24. As a user, I want to create a دستهٔ سفارشی with a color swatch, so that new buckets are visually distinct.
25. As a user, I want to rename any دسته including سیستمی ones, so that labels match my language.
26. As a user, I want to reorder categories, so that my most-used ones surface first.
27. As a user, I want deletion guarded (system and populated categories refuse with a clear error), with a move-expenses-then-delete path, so that I never orphan a خرج.
28. As a user, I want a category drilldown with its panel plus a locked-category add action, so that per-دسته review and capture stay together.

### Templates (الگوی تکرار)

29. As a user, I want a templates list showing active/paused state and whether this month's خرج was generated (with a jump to it), so that recurring obligations are legible.
30. As a user, I want to pause and resume a template, so that temporary stops don't destroy history.
31. As a user, I want a 3-month future preview with clamped days, so that I see coming installment amounts.
32. As a user, I want to create and edit a template with عنوان، مبلغ، روز ماه ۱ تا ۳۱، دسته، تاریخ شروع and optional end, so that monthly obligations self-generate including backfill from start to current month.
33. As a user, I want template create/edit in a native bottom sheet, so that it feels consistent with expense entry.

### Events (رویداد)

34. As a user, I want an events list with total + count overlays, so that I compare gatherings at a glance.
35. As a user, I want to create an event with عنوان and optional note, so that trips and parties get a second-layer bucket.
36. As a user, I want to rename an event, so that labels stay accurate.
37. As a user, I want deleting an event to unlink only (خرج‌ها keep their دسته and ماه), so that deletion is safe.
38. As a user, I want an event detail with its panel, a locked-event add action, and a delete with confirm, so that per-رویداد review is self-contained.
39. As a user, I want each خرج in an event to keep its own دسته and ماهِ وقوع, so that the event never replaces categorization.

### Search (جست‌وجو)

40. As a user, I want whole-ledger search by title substring with Persian normalization (ی/ي، digits, half-spaces — the same normalization the categorization engine uses), so that شیر finds شير.
41. As a user, I want each search hit to show مبلغ، ماهِ جلالی وقوع and دسته, so that I identify the right خرج.
42. As a user, I want tapping a hit to open the same Expense edit sheet, so that fix-from-search works.

### Insights (محصول / قیمت واحد)

43. As a user, I want a top products board of repeatable purchase titles with overall weighted average unit price and count, so that I see what I rebuy.
44. As a user, I want a monthly average-unit-price chart per product (weighted average, dashed overall average, readable values), so that inflation per product is visible.
45. As a user, I want purchase history per product, so that I audit individual خرج‌ها behind an average.

### Platform and data behavior

46. As a user, I want create/update/delete to refresh the affected month, lists, summaries, and insights without a full restart, so that the app feels live.
47. As a user on flaky networks, I want one consistent error shape for API failures with field-level validation messages where the server provides them, so that I know what to fix.
48. As a user, I want the mobile app to work against a configurable API base URL for local dev and production, so that testing and release point at the right backend.

## Implementation Decisions

- Minimal monorepo: the existing Next.js web app stays at the repo root; the mobile app and the shared package are added as workspace members. No move of the web app in this scope.
- One shared pure package holds the versioned API client wrapper, request/response shapes, Jalali calendar helpers, title normalization, and formatting helpers. Both web and mobile consume it; it has no web-only or native-only dependencies.
- The typed client wrapper stays the single programmatic path to the versioned API: typed inputs, runtime validation of success bodies against shared shapes, one error shape for non-2xx, and an injectable fetch function plus a per-call async header supplier for the bearer token.
- The versioned HTTP API is frozen for this work: no new endpoints, no contract changes. Mobile authenticates with the existing bearer mechanism and the same session semantics as web.
- Expo Router with 5 bottom tabs (Home, Categories, Events, Templates, Insights) plus stack screens for category and event detail and search. A native header on the tabs carries the search action (left) with the title centered; logout sits header-right on Home only. Expense and Template entry are modal bottom sheets, never full pages. (Amended by tickets 10–12 per user reviews 2026-09-12.)
- One universal sheet abstraction: native bottom sheet on iOS/Android, the existing web sheet primitive on expo web, behind one prop contract so every behavior is testable in a browser.
- One universal token store: secure storage on native, browser storage on web, behind one get/set contract, fed into the client header supplier.
- One custom Jalali calendar built on the existing Jalali core (already pure calendar logic with Tehran timezone handling): Gregorian ISO storage, Jalali month key grouping, unbounded month shifting, Persian-digit display. No third-party picker with single-platform lock-in.
- Styling with the Tailwind-compatible native styling solution and RTL enabled, reusing the web theme tokens so the mobile look stays in the same family without pixel parity.
- Server-state management with a query-caching data layer over the typed client: per-month and per-list queries, mutations with invalidation of affected scopes, pull-to-refresh, and classification lookup on title blur for the پیشنهاد badge.
- Auth screens (sign-in, sign-up, forgot, reset) live in-app and honor the verified-email gate with a resend path.
- Respects the recorded decision that every خرج has an occurrence date: mobile always requires a date and always derives the ledger month from it; no undated state exists on any screen, sheet, search hit, or insight.
- Domain language follows the project glossary throughout (خرج، دسته، دستهٔ سیستمی/سفارشی، شناسهٔ سیستمی دسته، الگوی تکرار، پیش‌بینی، ماهِ وقوع، واژهٔ یادگرفته، واژه‌نامهٔ سیستمی، پیشنهاد، محصول، رویداد، جست‌وجو، تعداد/واحد/قیمت واحد) and avoids its listed synonyms.

## Testing Decisions

- What makes a good test here: assert externally visible behavior at the highest seam (what the user sees or what the wire carries), not implementation details of components, hooks, or styling.
- Primary seam is the frozen versioned API wire contract: existing contract and integration coverage for months, summaries, expenses, categories, templates, events, search, and classification stays green and is the gate for any shared-package extraction. New extraction must not change a single wire byte.
- Shared pure modules get unit tests with injected fetch (no network): typed requests with query/body shape, success-body validation, the single error shape including non-JSON fallbacks, Jalali month-key derivation and shifting, title normalization parity with the engine, and quantity/unit arithmetic including weighted average unit price.
- Prior art to follow: the existing client wrapper unit tests with injected fetch, the Jalali and normalization unit tests, the problem-shape tests, and the integration contract tests against real handlers.
- Mobile screens get interaction tests runnable against the expo web build: Dashboard totals and forecast badge, month navigation, ledger interleaving, Expense and Template sheet flows (create, edit, save-and-new, delete confirm, locked category/event), guarded category deletion with move-expenses, template pause/resume and preview, event unlink-only deletion, normalized search with hit metadata, and insights averages.
- Auth flows get interaction tests including the unverified-email block with resend and the reset path, using the same injected-fetch seam rather than a live backend.

## Out of Scope

- Any change to the versioned API surface, persistence, session rules, seeding, or server behavior.
- Offline queueing, background sync, push notifications, biometric login, multi-currency, receipt images, or attachments.
- Pixel parity with the web UI, web marketing pages, admin tooling, or design-system unification beyond shared theme tokens.
- Moving the Next.js app into a subdirectory, CI/CD pipeline work beyond adding workspace members, or app-store submission and signing.
- New domain vocabulary or glossary changes; no CONTEXT.md or ADR writes in this scope.

## Further Notes

- The calendar core and classification normalization already exist as pure logic on web; extraction into the shared package is a move, not a rewrite, and wire parity is the acceptance bar.
- If bearer token issuance from the existing auth setup proves unwirable from Expo without a server tweak, that is a spec deviation: stop and ask before touching the server, per the frozen-API constraint.
- Suggested build order (for ticket slicing, not this spec): shared extraction with wire-parity tests, shell + auth + token store on expo web, Dashboard + Expense sheet tracer, Categories + drilldown, Templates, Events, Search, Insights, then device-pass hardening.
