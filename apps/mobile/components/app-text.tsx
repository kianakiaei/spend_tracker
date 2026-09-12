// App-wide Vazirmatn text (expo-mobile ticket 10).
//
// A drop-in <Text> replacement: resolves the style's fontWeight to the
// closest loaded Vazirmatn family (see src/font-weights.ts) and applies it,
// so screens keep their existing weight-carrying styles untouched. An
// explicit fontFamily in the style always wins; nesting inherits like plain
// RN Text. Import as `import { T as Text } from "…/app-text"`.

import {
  StyleSheet,
  Text as RNText,
  type TextProps,
} from "react-native";
import { fontFamilyForWeight } from "../src/font-weights";

export function T({ style, ...rest }: TextProps) {
  const flat = StyleSheet.flatten(style) ?? {};
  const family =
    flat.fontFamily ?? fontFamilyForWeight(flat.fontWeight);
  return <RNText style={[{ fontFamily: family }, style]} {...rest} />;
}
