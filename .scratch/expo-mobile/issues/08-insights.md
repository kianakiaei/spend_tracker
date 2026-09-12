# 08: Insights

**What to build:** The repeat-purchase board with top products, monthly average-unit-price trends, and per-product purchase history.

**Blocked by:** 02-shell-auth.

**Status:** done

- [x] Top products show overall weighted average unit price and count
- [x] Monthly trend shows weighted averages with an overall-average reference and readable values
- [x] History lists the expenses behind each average

Done 2026-09-12: `apps/mobile/src/insights.ts` holds the pure core (`insightWindowKeys` trailing-12-month window, `buildProductInsights` grouping by canonical title with count≥2 / count-then-total sort / 20-cap / weighted averages via the shared quantity helpers — web `getTopProductsAllTime` parity, `historyFor` newest-first) and `apps/mobile/src/insights-queries.ts` the loader (one `expenses.listByMonth` per window month in parallel; no own invalidator, the expense/category/template/event fan-outs already refresh the `insights` scope); `app/insights.tsx` (protected stack screen, linked from More) renders the board with product filter, per-month weighted rows plus a «میانگین کل» reference row, and read-only purchase history like the web board. No server change. Frozen-API note: trailing-12-month window labelled «۱۲ ماه اخیر» — the frozen API exposes no insights/all-time read, so repeats older than the window are out of scope (needs a new read; web monthly SVG chart rendered as readable rows on mobile). Gate: `tests/unit/mobile-insights.test.ts` (11 tests), full suite 594 passed, root + mobile tsc and eslint clean. Code-review fixes applied: filter-empty string centralized in `INSIGHT_MESSAGES`, stack title unified to «بینش محصول‌ها». Follow-ups: screen interaction tests belong to ticket 09.
