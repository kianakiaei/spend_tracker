# 10: Shell polish — 3-tab nav, native headers, Vazirmatn, tile colors, insight bars

**What to build:** Answer user review of the expo web build (2026-09-12):
seven tab icons, search as a tab, a dead «بیشتر» page, system font instead of
وزیرمتن, a bar-less insights board, colorless home tiles, and headerless
screens. Collapse to three bottom tabs (خانه، دسته‌ها، رویدادها) with native
headers everywhere; search moves into the header as a stack screen; a «…»
header menu holds الگوهای تکرار, بینش محصول‌ها, and خروج (the More tab and
its page go away); Vazirmatn ships via expo-font and applies app-wide;
dashboard tiles wear their washed category tint with ledger color dots; the
insights trend becomes readable horizontal bars with the overall average as
reference.

**Blocked by:** 07-search, 08-insights.

**Status:** done

- [x] Three bottom tabs only; search + «…» menu in the native header; no More tab/page
- [x] Native headers with Persian titles on every tab and stack screen
- [x] Vazirmatn on every text surface (tabs, headers, screens, sheets)
- [x] Home tiles tinted by category color; ledger rows carry a color dot
- [x] Insights monthly trend reads as bars with values + overall reference

Done 2026-09-12 in three commits: (1) 3-tab nav + header search/menu + search→stack + More/​_panel removal (`MOBILE_TABS` + ticket-02 route test updated, spec story 6 + impl bullet amended); (2) Vazirmatn via `expo-font@57` with three static TTFs + `T` wrapper + font gate in the root layout + Bold tab/header titles; (3) `tintOf` moved verbatim to `@spend-tracker/shared/color.ts` (web re-exports, zero visual change) with tile tints + ledger dots on Home and readable bar rows on Insights. Gate: full suite green, root + mobile tsc and eslint clean. Notes: pnpm wrote a dangling `apps/mobile/node_modules/expo-font` junction in this env (repaired locally, gitignored — rerun `pnpm install` if Metro cannot resolve expo-font); all-time insights + expo-web interaction tests still belong to ticket 09.

**Decisions (user overrides spec 2026-09-12):** spec.md said «5 bottom tabs
(Home, Categories, Events, Search, More with Templates + Insights +
Sign-out)» — the user explicitly replaced it with 3 tabs + header
actions, so `MOBILE_TABS` and the ticket-02 route test change accordingly
(spec story 6 + implementation bullet amended in this ticket's commits).
Vazirmatn ships as three static TTFs (Regular/Bold/ExtraBold) because
react-native cannot use the web woff2 variable file; one `src/font.ts`
module maps fontWeight to the right family so no screen is touched for
styling. `tintOf` moves verbatim into `@spend-tracker/shared/color.ts`
(web re-exports it — zero wire/visual change on web). Insights bars stay
pure-View (no new native chart dep, expo-web safe); the web SVG chart is
untouched.
