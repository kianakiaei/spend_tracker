# 17: Native sheet via expo-ui + picker RTL

**What to build:** Answer user review (2026-09-12, eighth round): (1) the
hand-rolled sheet still feels off and the tab bar shows through — replace
with the OS component (`@expo/ui` BottomSheet: UISheetPresentationController
on iOS, Material on Android, web fallback; Expo Go included), RN forms
bridged via RNHostView with half/full snaps; (2) keep hunting iOS RTL —
this round found the date picker with no `direction` at all (شنبه leftmost).

**Blocked by:** none.

**Status:** done

- [x] UniversalSheet renders `BottomSheet` + `RNHostView`; physics code deleted
- [x] Picker card gets `direction: "rtl"`

Done 2026-09-12: hand-rolled Animated physics deleted (the tab bar showing
through dies with it — the OS modal owns the scrim and covers everything);
`@expo/ui@57` added; sheet headers/titles unchanged, forms untouched inside
the host. Gate: mobile tsc + eslint clean, web export bundles, full suite
629 green. iOS RTL remainder still needs a device screenshot — the picker gap
was the only missing `direction` found in a full-root audit.
