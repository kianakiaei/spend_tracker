# 13: Auth + welcome polish — ledger-paper identity, real loading states

**What to build:** Answer user review (2026-09-12, fourth round): the
welcome page and the four auth screens look templated — bare titles, an
off-palette orange button, "…" as the only loading sign, bare inputs and
error text. Give them one identity (coin medallion + Vazirmatn scale on the
app's paper/ink/jade tokens) and honest states: spinner buttons that disable
the form while pending, focused input borders, tinted error/success strips,
password visibility toggles, and return-key submit.

**Blocked by:** none (auth surfaces only).

**Status:** done

- [x] Welcome: medallion hero + pitch + primary/secondary actions
- [x] Shared `_forms`: medallion header block, jade pill buttons with
      spinners, focused/disabled fields, strip errors/notes, link style,
      password toggle, return-key submit
- [x] All four screens use the new primitives with subtitles; flows unchanged

Done 2026-09-12 in one commit: coin-medallion identity (the app icon in pure
Views) on the welcome hero and every auth header; the stray orange button is
jade now; pending shows a spinner and disables the whole form; inputs get
jade focus rings, keychain types, autofocus, and return-key submit; password
fields get eye toggles; errors/notes are tinted strips; links are centered
jade actions. Gate: mobile tsc + eslint clean (flows untouched, core tests
unaffected).
