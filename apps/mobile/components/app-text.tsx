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
import {
  FONT_FAMILY_REGULAR,
  fontFamilyForWeight,
} from "../src/font-weights";

/** Vazirmatn for TextInputs (they are not Text, so the T wrapper cannot
 * reach them): spread into every input style. */
export const INPUT_FONT_STYLE = {
  fontFamily: FONT_FAMILY_REGULAR,
} as const;

export function T({ style, ...rest }: TextProps) {
  const flat = StyleSheet.flatten(style) ?? {};
  const family =
    flat.fontFamily ?? fontFamilyForWeight(flat.fontWeight);
  return <RNText style={[{ fontFamily: family }, style]} {...rest} />;
}
