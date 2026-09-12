// Jalali month-grid picker (expo-mobile ticket 11).
//
// A custom calendar on the shared Jalali core: Gregorian ISO storage, Jalali
// month-key grouping, unbounded month shifting, Persian-digit display — no
// third-party picker with single-platform lock-in. Pure RN Views in a Modal,
// so it works identically on iOS, Android, and expo web. Opened from the
// Expense/Template sheets' date buttons; the day-math lives in the tested
// src/jalali-picker.ts seam, this component only renders it.

import { useState } from "react";
import { Modal, Pressable, View } from "react-native";
import {
  currentJalaliMonthKey,
  currentTehranISODate,
  jalaliMonthKeyLabel,
  shiftJalaliMonthKey,
  toPersianDigits,
} from "@spend-tracker/shared/jalali";
import { T as Text } from "./app-text";
import {
  JALALI_WEEKDAYS,
  dayNumberForISO,
  daysInJalaliMonth,
  isoForJalaliDay,
  leadingBlanks,
  monthKeyForISODate,
} from "../src/jalali-picker";

/** First valid page: the value's month, or the current month while the field
 * is still empty/invalid (a fresh template start date). */
function initialMonth(value: string): string {
  try {
    return monthKeyForISODate(value);
  } catch {
    return currentJalaliMonthKey();
  }
}

export function JalaliDatePicker({
  value,
  onSelect,
  onClose,
}: {
  /** Gregorian ISO storage value ("" while unset). */
  value: string;
  onSelect: (iso: string) => void;
  onClose: () => void;
}) {
  const [monthKey, setMonthKey] = useState(() => initialMonth(value));
  const today = currentTehranISODate();

  const blanks = leadingBlanks(monthKey);
  const days = daysInJalaliMonth(monthKey);
  const selectedDay = value === "" ? null : dayNumberForISO(value, monthKey);

  function pick(day: number) {
    onSelect(isoForJalaliDay(monthKey, day));
    onClose();
  }

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        accessibilityLabel="بستن تقویم"
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(28,26,23,0.45)",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <Pressable
          style={{
            width: "100%",
            maxWidth: 360,
            backgroundColor: "#fffdf9",
            borderRadius: 20,
            padding: 16,
            gap: 8,
            direction: "rtl",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Pressable
              accessibilityLabel="ماه قبل"
              onPress={() => setMonthKey((m) => shiftJalaliMonthKey(m, -1))}
              style={navButton}
            >
              {/* RTL: previous points right. */}
              <Text style={{ fontSize: 17 }}>›</Text>
            </Pressable>
            <Text style={{ flex: 1, textAlign: "center", fontSize: 15, fontWeight: "700" }}>
              {jalaliMonthKeyLabel(monthKey)}
            </Text>
            <Pressable
              accessibilityLabel="ماه بعد"
              onPress={() => setMonthKey((m) => shiftJalaliMonthKey(m, 1))}
              style={navButton}
            >
              {/* RTL: next points left. */}
              <Text style={{ fontSize: 17 }}>‹</Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: "row" }}>
            {JALALI_WEEKDAYS.map((name) => (
              <Text
                key={name}
                style={{ flex: 1, textAlign: "center", fontSize: 11.5, color: "#6b6259" }}
              >
                {name}
              </Text>
            ))}
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {Array.from({ length: blanks }, (_, i) => (
              <View key={`blank-${i}`} style={{ width: "14.2857%", aspectRatio: 1 }} />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const day = i + 1;
              const iso = isoForJalaliDay(monthKey, day);
              const selected = selectedDay === day;
              const isToday = iso === today;
              return (
                <Pressable
                  key={day}
                  accessibilityLabel={`${toPersianDigits(day)} ${jalaliMonthKeyLabel(monthKey)}`}
                  onPress={() => pick(day)}
                  style={{
                    width: "14.2857%",
                    aspectRatio: 1,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: selected ? "#1a7a5c" : "transparent",
                      borderWidth: !selected && isToday ? 1 : 0,
                      borderColor: "#1a7a5c",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: selected ? "800" : "400",
                        color: selected ? "#fff" : "#1c1a17",
                      }}
                    >
                      {toPersianDigits(day)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            accessibilityLabel="برو به امروز"
            onPress={() => {
              onSelect(today);
              onClose();
            }}
            style={{ alignItems: "center", paddingVertical: 6 }}
          >
            <Text style={{ fontSize: 13.5, color: "#1a7a5c", fontWeight: "700" }}>
              امروز
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const navButton = {
  width: 34,
  height: 34,
  borderRadius: 17,
  alignItems: "center",
  justifyContent: "center",
} as const;
