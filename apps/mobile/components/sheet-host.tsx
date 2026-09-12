// Root sheet host (expo-mobile ticket 16 follow-up): renders presented
// sheets in an overlay above the navigator instead of an iOS Modal, whose
// presentation behavior proved unfixable by remote control. Paint order does
// the covering here — the overlay is the last sibling inside the root flex
// view, so no tab bar, header, or screen edge can ever show through or below
// a sheet. Screens keep rendering `UniversalSheet` (now a portal); all mount
// coordination lives here.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { StyleSheet, View } from "react-native";

interface SheetHost {
  present: (node: ReactNode) => void;
  dismiss: () => void;
}

const SheetHostContext = createContext<SheetHost | null>(null);

export function useSheetHost(): SheetHost {
  const host = useContext(SheetHostContext);
  if (!host) throw new Error("useSheetHost outside SheetHostProvider");
  return host;
}

export function SheetHostProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<ReactNode>(null);
  const present = useCallback((node: ReactNode) => setContent(node), []);
  const dismiss = useCallback(() => setContent(null), []);
  const value = useMemo(() => ({ present, dismiss }), [present, dismiss]);
  return (
    <SheetHostContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        {children}
        {content !== null ? (
          <View
            style={[StyleSheet.absoluteFill, { zIndex: 50, elevation: 50 }]}
            pointerEvents="box-none"
          >
            {content}
          </View>
        ) : null}
      </View>
    </SheetHostContext.Provider>
  );
}
