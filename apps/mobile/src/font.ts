// Font loading (expo-mobile ticket 10).
//
// expo-font loads the three static Vazirmatn TTFs at startup (OFL-licensed,
// same family as the web woff2 in src/app/fonts/). The root layout gates
// first paint on this; every Text then renders Vazirmatn through the T
// wrapper (components/app-text.tsx), while native headers/tab labels use the
// family names explicitly via font-weights.ts.

import * as Font from "expo-font";
import {
  FONT_FAMILY_BOLD,
  FONT_FAMILY_EXTRA_BOLD,
  FONT_FAMILY_REGULAR,
} from "./font-weights";
import VazirmatnBold from "../assets/fonts/Vazirmatn-Bold.ttf";
import VazirmatnExtraBold from "../assets/fonts/Vazirmatn-ExtraBold.ttf";
import VazirmatnRegular from "../assets/fonts/Vazirmatn-Regular.ttf";

export async function loadAppFonts(): Promise<void> {
  await Font.loadAsync({
    [FONT_FAMILY_REGULAR]: VazirmatnRegular,
    [FONT_FAMILY_BOLD]: VazirmatnBold,
    [FONT_FAMILY_EXTRA_BOLD]: VazirmatnExtraBold,
  });
}
