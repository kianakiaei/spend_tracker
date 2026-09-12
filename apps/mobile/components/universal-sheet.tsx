// Universal sheet (expo-mobile ticket 03): one prop contract behind two
// primitives — the native bottom sheet (a bottom-anchored Modal) on
// iOS/Android and a centered dialog over a scrim on expo web. The variant
// resolves in the pure src/sheet.ts seam so behavior stays testable in a
// browser.

import type { ReactNode } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import { resolveSheetVariant, type UniversalSheetProps } from "../src/sheet";

export function UniversalSheet({
  open,
  onClose,
  title,
  description,
  testID,
  children,
}: UniversalSheetProps & { children: ReactNode }) {
  if (!open) return null;
  if (resolveSheetVariant(Platform.OS) === "web") {
    return (
      <View
        testID={testID}
        style={{
          position: "fixed" as never,
          inset: 0 as never,
          zIndex: 50,
          alignItems: "center",
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.45)",
          direction: "rtl",
        }}
      >
        <Pressable
          accessibilityLabel="بستن"
          onPress={onClose}
          style={{ position: "absolute" as never, inset: 0 as never }}
        />
        <View
          style={{
            width: "100%",
            maxWidth: 560,
            maxHeight: "88%",
            backgroundColor: "#fff",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 20,
          }}
        >
          <SheetHeader title={title} description={description} onClose={onClose} />
          {children}
        </View>
      </View>
    );
  }
  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      testID={testID}
    >
      <Pressable
        accessibilityLabel="بستن"
        onPress={onClose}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}
      >
        <Pressable
          style={{
            backgroundColor: "#fff",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 20,
            direction: "rtl",
          }}
        >
          <SheetHeader title={title} description={description} onClose={onClose} />
          {children}
        </Pressable>
      </Pressable>
    </Modal>
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
