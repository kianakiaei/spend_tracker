// Session wiring (expo-mobile ticket 02).
//
// One SessionProvider restores the bearer token on launch (persistence across
// restarts), exposes the mobile auth client to every screen, and feeds the
// shared v1 client through the universal header supplier — the single
// programmatic path to the frozen versioned API.

import { createV1Client, type V1Client } from "@spend-tracker/shared/api/client";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createMobileAuthClient, type MobileAuthClient, type MobileSession } from "./auth-client";
import { loadMobileConfig } from "./config";
import { createKeyValueTokenStore, createAuthHeaderSupplier } from "./token-store";
import { platformStorage } from "./storage";

interface SessionValue {
  auth: MobileAuthClient;
  api: V1Client;
  session: MobileSession | null;
  status: "loading" | "ready";
  refreshSession: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const clients = useMemo(() => {
    const config = loadMobileConfig();
    // The token lives in platform storage (SecureStore / localStorage) so
    // the session survives restarts; the same store feeds the v1 client.
    const store = createKeyValueTokenStore(platformStorage());
    const auth = createMobileAuthClient({ apiBaseUrl: config.apiBaseUrl, tokenStore: store });
    const api = createV1Client({
      baseUrl: config.apiBaseUrl,
      headers: createAuthHeaderSupplier(store),
    });
    return { auth, api };
  }, []);

  const [session, setSession] = useState<MobileSession | null>(null);
  const [status, setStatus] = useState<"loading" | "ready">("loading");

  const refreshSession = async () => {
    setSession(await clients.auth.getSession());
  };

  useEffect(() => {
    let cancelled = false;
    clients.auth
      .getSession()
      .then((restored) => {
        if (!cancelled) setSession(restored);
      })
      .finally(() => {
        if (!cancelled) setStatus("ready");
      });
    return () => {
      cancelled = true;
    };
  }, [clients]);

  const value = useMemo<SessionValue>(
    () => ({ ...clients, session, status, refreshSession }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clients, session, status],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside <SessionProvider>");
  return value;
}
