// Shared auth-screen primitives (expo-mobile ticket 02). One Persian voice,
// one form shape; screens below compose these with the mobile auth client.

import type { ReactNode } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { MOBILE_AUTH_MESSAGES, MobileAuthError } from "../../src/auth-client";

export function AuthScreen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 64, gap: 16, direction: "rtl" }}>
      <Text style={{ fontSize: 22, fontWeight: "800" }}>{title}</Text>
      {children}
    </View>
  );
}

export function AuthField({
  label,
  value,
  onChangeText,
  secure,
  keyboard,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  secure?: boolean;
  keyboard?: "default" | "email-address";
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 13.5, fontWeight: "700" }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secure}
        keyboardType={keyboard}
        autoCapitalize="none"
        textAlign={secure ? "left" : undefined}
        style={{
          borderWidth: 1,
          borderColor: "#d8d3c8",
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 10,
          fontSize: 16,
        }}
      />
    </View>
  );
}

export function AuthButton({
  title,
  onPress,
  pending,
}: {
  title: string;
  onPress: () => void;
  pending?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={pending}
      style={{
        backgroundColor: "#b3541e",
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: "center",
        opacity: pending ? 0.6 : 1,
      }}
    >
      <Text style={{ color: "#fff", fontSize: 14.5, fontWeight: "800" }}>
        {pending ? "…" : title}
      </Text>
    </TouchableOpacity>
  );
}

export function AuthErrorText({ error }: { error: unknown }) {
  if (!error) return null;
  const message =
    error instanceof MobileAuthError
      ? (MOBILE_AUTH_MESSAGES[error.code] ?? String(error.message))
      : MOBILE_AUTH_MESSAGES.unknown;
  return (
    <Text accessibilityRole="alert" style={{ fontSize: 13.5, color: "#b3261e" }}>
      {message}
    </Text>
  );
}

export function AuthNote({ children }: { children: ReactNode }) {
  return (
    <Text
      accessibilityRole="summary"
      style={{ fontSize: 13.5, lineHeight: 26, color: "#2e7d46" }}
    >
      {children}
    </Text>
  );
}
