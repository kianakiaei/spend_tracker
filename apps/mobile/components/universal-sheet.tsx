// Universal sheet (expo-mobile tickets 03 + 16): one prop contract over
// `@gorhom/bottom-sheet` — the library owns physics, scrim, grabber, and
// swipe-to-dismiss on every platform, so nothing hand-rolled can drift
// off-brand. Screens keep rendering this component exactly as before.

import { useCallback, useEffect, useMemo, useRef } from "react";
import { Pressable, View } from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { T as Text } from "./app-text";
import type { UniversalSheetProps } from "../src/sheet";
import type { ReactNode } from "react";
const snapPoints = ["92%"];


export function UniversalSheet({
  open,
  onClose,
  title,
  description,
  children,
}: UniversalSheetProps & { children: ReactNode }) {
  const ref = useRef<BottomSheetModal>(null);

  // Controlled open state: presenting/dismissing follows the prop (the
  // library owns the motion between the two).
  useEffect(() => {
    if (open) ref.current?.present();
    else ref.current?.dismiss();
  }, [open]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.45}
        pressBehavior="close"
      />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      onDismiss={onClose}
      enablePanDownToClose
      keyboardBehavior="interactive"
      backgroundStyle={{
        backgroundColor: "#fff",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
      }}
      handleIndicatorStyle={{ backgroundColor: "#d8d3c8" }}
      backdropComponent={renderBackdrop}
    >
      <BottomSheetView style={{ flex: 1, paddingHorizontal: 20, paddingBottom: 20 }}>
        <SheetHeader title={title} description={description} onClose={onClose} />
        {children}
      </BottomSheetView>
    </BottomSheetModal>
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
    <View style={{ marginBottom: 12, gap: 2, direction: "rtl" }}>
      <SheetHeaderRow title={title} onClose={onClose} />
      {description ? (
        <Text style={{ fontSize: 12.5, color: "#6b6259" }}>{description}</Text>
      ) : null}
    </View>
  );
}

function SheetHeaderRow({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text style={{ fontSize: 17, fontWeight: "800" }}>{title}</Text>
      <Pressable accessibilityLabel="انصراف" onPress={onClose}>
        <Text style={{ fontSize: 14, color: "#6b6259" }}>انصراف</Text>
      </Pressable>
    </View>
  );
}
