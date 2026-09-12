// Platform storage adapter (expo-mobile ticket 02).
//
// Secure storage on native (expo-secure-store), browser storage on expo web
// (localStorage) — behind the one KeyValueStorage contract the universal
// token store consumes. This file is the ONLY module in apps/mobile/src with
// native imports, so it stays out of the root unit-test seam (which covers
// token-store.ts with injected adapters instead).

import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { KeyValueStorage } from "./token-store";

// Minimal browser-storage shape: the mobile tsconfig has no DOM lib (this
// module also loads on native, where `window` does not exist), so the
// contract is declared structurally instead of referencing DOM types.
interface WebLocalStorageShape {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

declare const window: { localStorage?: WebLocalStorageShape } | undefined;

function webLocalStorage(): WebLocalStorageShape | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

const webStorage: KeyValueStorage = {
  getItem: (key) => {
    try {
      return webLocalStorage()?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      webLocalStorage()?.setItem(key, value);
    } catch {
      // Private-mode / disabled storage: the session just won't persist.
    }
  },
  removeItem: (key) => {
    try {
      webLocalStorage()?.removeItem(key);
    } catch {
      // Best effort (see above).
    }
  },
};

const nativeStorage: KeyValueStorage = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

/** SecureStore on iOS/Android, localStorage on expo web. */
export function platformStorage(): KeyValueStorage {
  return Platform.OS === "web" ? webStorage : nativeStorage;
}
