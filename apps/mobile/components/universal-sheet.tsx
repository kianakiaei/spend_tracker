// Universal sheet (expo-mobile tickets 03 + 16): one prop contract — a
// fading scrim plus a spring-driven panel with a grabber handle and
// drag-to-dismiss. The sheet mounts through the root sheet host (a portal
// above the navigator) instead of an iOS Modal, whose presentation behavior
// proved unfixable by remote control: paint order does the covering here,
// so no tab bar, header, or screen edge can ever show through or below a
// sheet. Ticket 16's spring/grabber physics carry over unchanged.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Animated,
  BackHandler,
  Easing,
  PanResponder,
  Platform,
  Pressable,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { T as Text } from "./app-text";
import { useSheetHost } from "./sheet-host";
import type { UniversalSheetProps } from "../src/sheet";
import type { ReactNode } from "react";

const SCRIM_COLOR = "rgba(28,26,23,0.45)";
const ENTRY_OFFSET = 520;

/** Dismiss when dragged past this many points or flicked faster than this. */
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 0.9;

export function UniversalSheet({
  open,
  onClose,
  title,
  description,
  testID,
  children,
}: UniversalSheetProps & { children: ReactNode }) {
  const host = useSheetHost();
  // Portal into the root host: screens keep rendering this component exactly
  // as before, but the content mounts above the navigator. The node identity
  // only changes when the screen re-renders, and host updates converge
  // without remounting SheetContent (same type + position), so form state,
  // focus, and the entry animation survive parent renders.
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
  // Bleed the panel under the home indicator to the physical screen edge:
  // a panel that ends at the safe area leaves a dead strip with the tab bar
  // showing below it. Content keeps its clearance via padding.
  const bottomBleed = useSafeAreaInsets().bottom;
  // Animation instances live in state (lazy init): the v6 refs rule forbids
  // reading `.current` during render, and these values are only ever set up
  // once and driven imperatively afterwards.
  const [scrim] = useState(() => new Animated.Value(0));
  // Gesture: drag offset of the panel (0 at rest, positive going down).
  // Single value for entry + drag (no derived nodes): entry springs it to
  // rest, the gesture drives it after that.
  const [offset] = useState(() => new Animated.Value(ENTRY_OFFSET));

  useEffect(() => {
    // Entry: scrim fades in while the panel springs up from below.
    Animated.parallel([
      Animated.timing(scrim, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(offset, {
        toValue: 0,
        useNativeDriver: true,
        damping: 30,
        stiffness: 300,
        mass: 0.9,
      }),
    ]).start();
  }, [scrim, offset]);

  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(scrim, {
        toValue: 0,
        duration: 160,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(offset, {
        toValue: ENTRY_OFFSET,
        duration: 180,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  }, [onClose, scrim, offset]);

  // Android back button (the Modal's onRequestClose used to own this).
  // BackHandler exists only on native — subscribing on web logs an error.
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      dismiss();
      return true;
    });
    return () => sub.remove();
  }, [dismiss]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.dy > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_, gesture) =>
          offset.setValue(Math.max(gesture.dy, -48)),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > DISMISS_DISTANCE || gesture.vy > DISMISS_VELOCITY) {
            dismiss();
          } else {
            Animated.spring(offset, {
              toValue: 0,
              useNativeDriver: true,
              damping: 30,
              stiffness: 300,
            }).start();
          }
        },
      }),
    [dismiss, offset],
  );

  return (
    <View style={{ flex: 1 }} testID={testID}>
      <Animated.View
        style={{ flex: 1, opacity: scrim, backgroundColor: SCRIM_COLOR }}
      >
        <Pressable
          accessibilityLabel="بستن"
          onPress={dismiss}
          style={{ flex: 1 }}
        />
      </Animated.View>
      <Animated.View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: "center",
          transform: [{ translateY: offset }],
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
          <View
            {...pan.panHandlers}
            accessibilityLabel="کشیدن برای بستن"
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
          </View>
          <SheetHeader title={title} description={description} onClose={dismiss} />
          {children}
        </View>
      </Animated.View>
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
