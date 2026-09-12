// Universal sheet (expo-mobile tickets 03 + 16 + 17): one prop contract over
// the native `@expo/ui` BottomSheet — UISheetPresentationController physics
// on iOS, Material bottom sheet on Android, web fallback on expo web — with
// our RN form subtree bridged through RNHostView. Ticket 16's hand-rolled
// Animated physics is gone: the OS now owns the spring, the scrim, the
// grabber, and swipe-to-dismiss, so the sheet cannot look or feel off-brand.
// Sizing is `half`/`full` (native snap points); the form's own ScrollView
// owns overflow inside the fill-parent host.

import { Pressable, View } from "react-native";
import { BottomSheet, RNHostView } from "@expo/ui";
import { T as Text } from "./app-text";
import type { UniversalSheetProps } from "../src/sheet";
import type { ReactNode } from "react";

export function UniversalSheet({
  open,
  onClose,
  title,
  description,
  testID,
  children,
}: UniversalSheetProps & { children: ReactNode }) {
  if (!open) return null;
  return (
    <BottomSheet
      isPresented={open}
      onDismiss={onClose}
      snapPoints={["half", "full"]}
      testID={testID}
    >
      <RNHostView>
        <View
          style={{
            flex: 1,
            backgroundColor: "#fff",
            paddingHorizontal: 20,
            paddingBottom: 20,
            direction: "rtl",
          }}
        >
          <SheetHeader title={title} description={description} onClose={onClose} />
          {children}
        </View>
      </RNHostView>
    </BottomSheet>
  );
}

function SheetHeader({
  title,
  description,
  onClose,
}: {
  title: string;
  description?: string;
  onClose: () => void;
}) {
  return (
    <View style={{ marginBottom: 12, gap: 2 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 17, fontWeight: "800" }}>{title}</Text>
        <Pressable accessibilityLabel="انصراف" onPress={onClose}>
          <Text style={{ fontSize: 14, color: "#6b6259" }}>انصراف</Text>
        </Pressable>
      </View>
      {description ? (
        <Text style={{ fontSize: 12.5, color: "#6b6259" }}>{description}</Text>
      ) : null}
    </View>
  );
}
