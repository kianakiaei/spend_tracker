// Shared shell primitives for the ticket-02 placeholders. Later tickets
// (03+) replace each screen body with its real surface; the tab/stack shapes
// here are already final.

import type { ReactNode } from "react";
import { Text, View } from "react-native";

export function ShellPanel({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        gap: 8,
        direction: "rtl",
      }}
    >
      <Text style={{ fontSize: 20, fontWeight: "800" }}>{title}</Text>
      {children}
    </View>
  );
}

export function ShellNote({ children }: { children: ReactNode }) {
  return <Text style={{ fontSize: 13.5, opacity: 0.6, textAlign: "center" }}>{children}</Text>;
}
