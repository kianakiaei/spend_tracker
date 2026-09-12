# 15: Native platform chrome — UIKit/Material tabs + blur bar

**What to build:** Answer user review (2026-09-12, sixth round): the tab
bar looks five years old on both platforms. expo-router 57's bundled
bottom-tabs fork already carries per-platform variants — use them instead of
one custom bar: UIKit blur on iOS, Material 3 on Android, keep expo web
working. (True UITabBar Liquid Glass needs `unstable-native-tabs`, which
requires a dev build and drops web — out of scope while the user tests on
Expo Go + web.)

**Blocked by:** none.

**Status:** done

- [x] `tabBarVariant` material on Android, uikit elsewhere
- [x] iOS bar: transparent bg, hairline gone, `BlurView` background
- [x] Android: M3 surface + jade active pill tint
- [x] Web keeps current size fix; paper scene background everywhere

Done 2026-09-12 in one commit (+`expo-blur@57`): the bundled bottom-tabs
fork already carries per-platform variants, so no custom bar and no native
build. Gate: mobile tsc + eslint clean, web export bundles, full suite 629
green. Note: true UITabBar Liquid Glass needs `unstable-native-tabs`
(dev build only, no web/Expo-Go) — revisit when device builds exist.
