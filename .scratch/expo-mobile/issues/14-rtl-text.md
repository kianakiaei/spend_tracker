# 14: RTL text on device — writing direction + default alignment

**What to build:** Answer user review (2026-09-12, fifth round, iOS Expo
Go): layout mirrors, but text renders LTR — category names/descriptions,
home total and row subtitles, insights strings. Root cause: `direction:
"rtl"` flips flex layout, but iOS text needs its own base direction
(`writingDirection`) and alignment; bare `<Text>` defaults to left/natural.

**Blocked by:** none.

**Status:** done

- [x] `T` wrapper defaults every text to `writingDirection: "rtl"` +
      `textAlign: "right"` (explicit styles still win — centers kept)
- [x] Persian inputs right-aligned via `INPUT_FONT_STYLE`; email/password
      stay left

Done 2026-09-12 in one commit: `direction: "rtl"` on containers only flips
flex layout — iOS text needs its own base direction, so the wrapper now sets
`writingDirection: "rtl"` (nested Texts inherit it; mixed strings like
«۱۲۹٬۸۷۷ تومان» order correctly) with right alignment matching web
`dir=rtl`. Gate: mobile tsc + eslint clean (view-only change).
