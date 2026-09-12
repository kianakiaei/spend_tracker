// Universal sheet (expo-mobile tickets 03 + 16): one prop contract, one
// physics implementation — a fading scrim plus a spring-driven panel with a
// grabber handle and drag-to-dismiss, on iOS, Android, and expo web (the
// Modal portal also keeps the web sheet above the tab bar). Ticket 16
// rebuilt this because the old native variant wrapped scrim and panel in a
// single `slide` Modal animation: the backdrop slid up _with_ the sheet,
// which reads as cheap. Now the scrim only ever fades and the panel only
// ever springs/slides, with velocity-aware dismiss vs snap-back.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  PanResponder,
  Pressable,
  View,
} from "react-native";
import { T as Text } from "./app-text";
import type { UniversalSheetProps } from "../src/sheet";
import type { ReactNode } from "react";

const SCRIM_COLOR = "rgba(28,26,23,0.45)";
const ENTRY_OFFSET = 520;

/** Dismiss when dragged past this many points or flicked faster than this. */
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 0.9;

function AnimatedSheet({
  onClose,
  title,
  description,
  testID,
  children,
}: UniversalSheetProps & { children: ReactNode }) {
  // Animation instances live in state (lazy init): the v6 refs rule forbids
  // reading `.current` during render, and these values are only ever set up
  // once and driven imperatively afterwards.
  const [scrim] = useState(() => new Animated.Value(0));
  const [entry] = useState(() => new Animated.Value(ENTRY_OFFSET));
  // Gesture: drag offset of the panel (0 at rest, positive going down).
  const [drag] = useState(() => new Animated.Value(0));

  useEffect(() => {
    // Entry: scrim fades in while the panel springs up from below.
    Animated.parallel([
      Animated.timing(scrim, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(entry, {
        toValue: 0,
        useNativeDriver: true,
        damping: 30,
        stiffness: 300,
        mass: 0.9,
      }),
    ]).start();
  }, [scrim, entry]);

  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(scrim, {
        toValue: 0,
        duration: 160,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(drag, {
        toValue: ENTRY_OFFSET,
        duration: 180,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  }, [onClose, scrim, drag]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.dy > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_, gesture) =>
          drag.setValue(Math.max(gesture.dy, -48)),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > DISMISS_DISTANCE || gesture.vy > DISMISS_VELOCITY) {
            dismiss();
          } else {
            Animated.spring(drag, {
              toValue: 0,
              useNativeDriver: true,
              damping: 30,
              stiffness: 300,
            }).start();
          }
        },
      }),
    [dismiss, drag],
  );

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={dismiss}
      testID={testID}
    >
      <View style={{ flex: 1 }}>
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
            transform: [{ translateY: Animated.add(entry, drag) }],
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
              paddingBottom: 20,
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
    </Modal>
  );
}

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
    <AnimatedSheet
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      testID={testID}
    >
      {children}
    </AnimatedSheet>
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
