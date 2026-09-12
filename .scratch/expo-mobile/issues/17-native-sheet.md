# 17: Native sheet via expo-ui + picker RTL

**What to build:** Answer user review (2026-09-12, eighth round): (1) the
hand-rolled sheet still feels off and the tab bar shows through — replace
with the OS component (`@expo/ui` BottomSheet: UISheetPresentationController
on iOS, Material on Android, web fallback; Expo Go included), RN forms
bridged via RNHostView with half/full snaps; (2) keep hunting iOS RTL —
this round found the date picker with no `direction` at all (شنبه leftmost).

**Blocked by:** none.

**Status:** rolled back (sheet); picker direction kept

Rolled back 2026-09-12 per user review: the `@expo/ui` BottomSheet felt
worse than the hand-rolled physics, so `universal-sheet.tsx` is restored to
the ticket-16 Animated implementation (fading scrim, spring entry, grabber
drag-to-dismiss) and the `@expo/ui` dependency is removed. The picker
`direction: "rtl"` fix stays.
