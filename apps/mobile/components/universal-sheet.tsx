// Universal sheet (expo-mobile tickets 03 + 16): one prop contract — a
// static dimming scrim plus a bottom-pinned panel with a grabber, mounted
// through the root sheet host (a portal above the navigator, so no tab bar,
// header, or screen edge can ever show through or below a sheet).
//
// Deliberately animation-free (ticket 16 follow-up): the Animated entry and
// drag physics could not be verified on-device and behaved unobservably in
// production, so they are out until a device-confirmed motion pass. What
// remains is deterministic — full-window scrim, opaque panel pinned to the
// physical bottom edge with home-indicator bleed, tap-scrim / grabber /
// back-button dismiss.

import { useEffect } from "react";
import { BackHandler, Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { T as Text } from "./app-text";
import { useSheetHost } from "./sheet-host";
import type { UniversalSheetProps } from "../src/sheet";
import { useMemo, type ReactNode } from "react";

const SCRIM_COLOR = "rgba(28,26,23,0.45)";

export function UniversalSheet({
  open,
  onClose,
  title,
  description,
  testID,
  children,
}: UniversalSheetProps & { children: ReactNode }) {
  const host = useSheetHost();
  const node = useMemo(
    () => (
      <SheetContent
        onClose={onClose}
        title={title}
        description={description}
        testID={testID}
      >
        {children}
      </SheetContent>
    ),
    [onClose, title, description, testID, children],
  );
  useEffect(() => {
    if (!open) return;
    host.present(node);
    return () => host.dismiss();
  }, [open, host, node]);
  return null;
}

function SheetContent({
  onClose,
  title,
  description,
  testID,
  children,
}: Omit<UniversalSheetProps, "open"> & { children: ReactNode }) {
  // Bleed the panel under the home indicator to the physical screen edge.
  // Content keeps its clearance via padding.
  const bottomBleed = useSafeAreaInsets().bottom;

  // Android back button (native only — the web BackHandler logs an error).
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  return (
    <View style={{ flex: 1 }} testID={testID}>
      <View style={{ flex: 1, backgroundColor: SCRIM_COLOR }}>
        <Pressable
          accessibilityLabel="بستن"
          onPress={onClose}
          style={{ flex: 1 }}
        />
      </View>
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: "center",
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 560,
            maxHeight: "88%",
            backgroundColor: "#fff",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingHorizontal: 20,
            paddingBottom: 20 + bottomBleed,
            marginBottom: -bottomBleed,
            direction: "rtl",
          }}
        >
          <Pressable
            accessibilityLabel="بستن"
            onPress={onClose}
            style={{ alignItems: "center", paddingVertical: 8 }}
          >
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: "#d8d3c8",
              }}
            />
          </Pressable>
          <SheetHeader title={title} description={description} onClose={onClose} />
          {children}
        </View>
      </View>
    </View>
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
