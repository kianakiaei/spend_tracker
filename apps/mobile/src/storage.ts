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

const webStorage: KeyValueStorage = {
  getItem: (key) => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Private-mode / disabled storage: the session just won't persist.
    }
  },
  removeItem: (key) => {
    try {
      window.localStorage.removeItem(key);
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
