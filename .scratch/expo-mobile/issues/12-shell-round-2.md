# 12: Shell round 2 — 5 tabs, category color, RTL chevrons, line chart

**What to build:** Answer user review (2026-09-12, third round): templates
and insights belong in the bottom bar; logout must not cover the back button
(header, home tab only); the category drilldown panel should wear the washed
tint (web parity) instead of a lone dot; month chevrons point the wrong way
in RTL; category edit cannot change color; form category options should be
colored chips; dashboard tiles should be anchor-full + rest-half (percentage
sizing breaks content); tab icons/labels clip on expo web; insights deserves
the vertical line chart, not horizontal bars.

**Blocked by:** 11-form-chrome-polish.

**Status:** done

- [x] Five tabs (Home, Categories, Events, Templates, Insights); header keeps
      search-left + centered title; logout icon header-right on Home only;
      stack screens keep a clean back header; «…» menu deleted
- [x] Drilldown panel tinted with the category color (web parity); month
      chevrons RTL-correct on dashboard, drilldowns, event detail, picker
- [x] Category rename carries an optional color patch (swatches in edit);
      expense/template category options are tinted chips with dots
- [x] Dashboard: largest tile full-width, everything else half-width
- [x] Insights trend is a vertical SVG line chart (port of the web
      MonthlyChart: weighted points, dashed overall reference, readable
      values, tap-a-dot readout) via `react-native-svg`
- [x] Tab bar sized for expo web (smaller icons/labels, taller bar)

Done 2026-09-12 in three commits: (1) 5-tab bar + screens moved into tabs +
logout-on-Home + menu deletion (`MOBILE_TABS`/stack table + ticket-02 test +
spec amended; compact 22px icons, 11px labels, 64px bar); (2) tinted
drilldown panel + RTL chevron/back swap on all four navigators +
rename-with-color core (one PATCH, tested) with edit swatches + tinted
chips with dots in both sheets + anchor-full/rest-half tiles; (3)
`react-native-svg@15` + `InsightsChart` (web geometry verbatim, tap readout
instead of hover). Gate: full suite green, root + mobile tsc and eslint
clean.

**Decisions:** spec amended again (3 tabs → 5 with Templates + Insights;
logout header-only on Home). `react-native-svg` is the one new native dep
(Expo Go + web safe); the chart ports the web geometry verbatim with
touch instead of hover. Rename-with-color is one PATCH (no extra endpoint).

Follow-up 2026-09-12: expo web warned «Unknown event handler property
`onResponderTerminate`» on the chart dots — RNSVG web wires PanResponder
props for `onPress`. Dots now take `onClick` on web and `onPress` on native
(verified in the installed `prepare.js`: without touchable props no
responder mixin attaches, and a direct `onClick` flows through `...rest` to
the DOM node).

Follow-up 2026-09-12 (3): smoother chart theme — Catmull-Rom curve instead
of kinked segments (round caps/joins), soft area fill under the line, faint
gridlines, larger dots with a halo on the tapped one. Tap-a-dot readout and
tooltip unchanged.

Follow-up 2026-09-12 (2): the tab bar laid out LTR on expo web (Home on
the left) — screens set `direction: "rtl"` explicitly but the bar container
never got it. `tabBarStyle` now carries `direction: "rtl"` so the first tab
renders rightmost; native is unchanged (already RTL via I18nManager).
