// Universal sheet abstraction (expo-mobile ticket 03, spec: "one universal
// sheet abstraction: native bottom sheet on iOS/Android, the existing web
// sheet primitive on expo web, behind one prop contract so every behavior is
// testable in a browser").
//
// This module is pure: the variant resolves from an injected platform string
// (no react-native import — the node unit-test seam covers it directly), and
// the UI component in apps/mobile/components renders the native bottom sheet
// or the web primitive behind the one UniversalSheetProps contract below.

export type SheetVariant = "native" | "web";

export interface UniversalSheetProps {
  /** False renders nothing (the sheet owns no visibility state itself). */
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  testID?: string;
  /** Sheet body — on the type so the contract lives in one place (the
   * component narrows it to ReactNode). */
  children?: unknown;
}

/** Native bottom sheet on iOS/Android, the web sheet primitive on expo web. */
export function resolveSheetVariant(platform: string): SheetVariant {
  return platform === "web" ? "web" : "native";
}
