# 03: Dashboard and Expense sheet tracer

**What to build:** The core daily loop: Jalali month navigation with totals plus forecast, per-category tiles, the interleaved recorded-plus-forecast ledger, and the native Expense bottom sheet for create/edit/save-and-new/delete with suggestion badge and quantity/unit support.

**Blocked by:** 02-shell-auth.

**Status:** ready-for-agent

- [ ] Month navigator is unbounded with totals, forecast total, and forecast rows badged as estimates, recorded first on day ties
- [ ] Expense sheet captures title, whole-Toman amount, quantity plus unit, mandatory occurrence date with month derived from it, category, and optional event
- [ ] Category suggestion shows its badge, stays freely changeable, and honors the repeat-generated notice and locked category/event entry points
- [ ] Tapping a ledger row opens edit; delete asks inline confirm; lists refresh without restart
