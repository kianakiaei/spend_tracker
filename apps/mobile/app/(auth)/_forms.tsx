// Shared auth-screen primitives (expo-mobile tickets 02 + 13). One Persian
// voice, one ledger-paper identity: the coin medallion (jade disc, paper
// coin — the app icon in Views) tops every auth surface, Vazirmatn carries
// the scale, and states are honest — spinner buttons that disable the form
// while pending, jade focus rings, tinted error/success strips. Screens
// below compose these with the mobile auth client; flows are unchanged.

import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { INPUT_FONT_STYLE, T as Text } from "../../components/app-text";
import { MOBILE_AUTH_MESSAGES, MobileAuthError } from "../../src/auth-client";

const INK = "#1c1a17";
const JADE = "#1a7a5c";
const JADE_DEEP = "#136047";
const MUTED = "#6b6259";
const RULE = "#d8d3c8";
const PAPER = "#fffdf9";
const DANGER = "#b3261e";
const DANGER_SOFT = "#fae9e7";
const SUCCESS_SOFT = "#e4f0e9";

/** The coin medallion: jade disc, paper coin, jade pupil — the app icon in
 * pure Views, so it renders identically on native and expo web. */
export function AuthMedallion({ size = 88 }: { size?: number }) {
  const pupil = Math.round(size * 0.24);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: JADE,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          width: (size * 500) / 1024,
          height: (size * 500) / 1024,
          borderRadius: size / 4,
          backgroundColor: PAPER,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: pupil,
            height: pupil,
            borderRadius: pupil / 2,
            backgroundColor: JADE,
          }}
        />
      </View>
    </View>
  );
}

export function AuthScreen({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: PAPER,
        direction: "rtl",
      }}
    >
      <View style={{ paddingHorizontal: 24, paddingTop: 72, gap: 16 }}>
        <AuthMedallion size={64} />
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 22, fontWeight: "800" }}>{title}</Text>
          <Text style={{ fontSize: 13.5, color: MUTED, lineHeight: 22 }}>
            {subtitle}
          </Text>
        </View>
        {children}
      </View>
    </View>
  );
}

export function AuthField({
  label,
  value,
  onChangeText,
  secure,
  keyboard,
  autoFocus,
  disabled,
  returnKeyType,
  onSubmitEditing,
  textContentType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  secure?: boolean;
  keyboard?: "default" | "email-address";
  autoFocus?: boolean;
  disabled?: boolean;
  returnKeyType?: TextInputProps["returnKeyType"];
  onSubmitEditing?: () => void;
  textContentType?: TextInputProps["textContentType"];
}) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 13.5, fontWeight: "700" }}>{label}</Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          borderWidth: focused ? 2 : 1,
          borderColor: focused ? JADE : RULE,
          borderRadius: 12,
          backgroundColor: disabled ? "#f3efe6" : PAPER,
          paddingHorizontal: 12,
          opacity: disabled ? 0.7 : 1,
        }}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secure && !revealed}
          keyboardType={keyboard}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={autoFocus}
          editable={!disabled}
          returnKeyType={returnKeyType}
          textContentType={textContentType}
          onSubmitEditing={onSubmitEditing ? () => onSubmitEditing() : undefined}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          blurOnSubmit={false}
          textAlign={secure ? "left" : undefined}
          style={{
            ...INPUT_FONT_STYLE,
            flex: 1,
            paddingVertical: 10,
            fontSize: 16,
            color: INK,
          }}
        />
        {secure ? (
          <Pressable
            accessibilityLabel={revealed ? "پنهان کردن رمز" : "نمایش رمز"}
            accessibilityRole="button"
            disabled={disabled}
            onPress={() => setRevealed((v) => !v)}
            style={{ padding: 4 }}
          >
            <Ionicons
              name={revealed ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={MUTED}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function AuthButton({
  title,
  onPress,
  pending,
  disabled,
}: {
  title: string;
  onPress: () => void;
  pending?: boolean;
  disabled?: boolean;
}) {
  const off = pending === true || disabled === true;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => ({
        backgroundColor: pressed && !off ? JADE_DEEP : JADE,
        borderRadius: 999,
        paddingVertical: 13,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 50,
        opacity: off ? 0.65 : 1,
      })}
    >
      {pending === true ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function AuthErrorText({ error }: { error: unknown }) {
  if (!error) return null;
  const message =
    error instanceof MobileAuthError
      ? (MOBILE_AUTH_MESSAGES[error.code] ?? String(error.message))
      : MOBILE_AUTH_MESSAGES.unknown;
  return (
    <View
      accessibilityRole="alert"
      style={{
        backgroundColor: DANGER_SOFT,
        borderRadius: 12,
        borderStartWidth: 3,
        borderStartColor: DANGER,
        paddingHorizontal: 12,
        paddingVertical: 10,
      }}
    >
      <Text style={{ fontSize: 13.5, color: DANGER, lineHeight: 22 }}>
        {message}
      </Text>
    </View>
  );
}

export function AuthNote({ children }: { children: ReactNode }) {
  return (
    <View
      accessibilityRole="summary"
      style={{
        backgroundColor: SUCCESS_SOFT,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
      }}
    >
      <Text style={{ fontSize: 13.5, lineHeight: 24, color: JADE_DEEP }}>
        {children}
      </Text>
    </View>
  );
}

export function AuthLink({
  href,
  children,
}: {
  href: "/(auth)/sign-in" | "/(auth)/sign-up" | "/(auth)/forgot";
  children: ReactNode;
}) {
  return (
    <View style={{ alignItems: "center", paddingVertical: 2 }}>
      <Link href={href} asChild>
        <Pressable accessibilityRole="link">
          <Text style={{ fontSize: 14, color: JADE, fontWeight: "700" }}>
            {children}
          </Text>
        </Pressable>
      </Link>
    </View>
  );
}
