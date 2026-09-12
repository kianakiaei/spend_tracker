// Mobile auth client (expo-mobile ticket 02).
//
// Talks to the EXISTING better-auth mount (/api/auth/*) with plain fetch —
// no server change (frozen API constraint). Sign-up never signs in
// (requireEmailVerification, like web); a verified sign-in persists the
// bearer plugin's set-auth-token header in the universal token store, and the
// store feeds the shared v1 client via createAuthHeaderSupplier. Persian
// message voice mirrors the web forms (login-form / forgot-form /
// reset-form) so both surfaces speak one language.

import { resolveAuthBaseUrl } from "./config";
import type { TokenStore } from "./token-store";
import { createMemoryTokenStore } from "./token-store";

export type MobileAuthErrorCode =
  | "unverified"
  | "invalid-credentials"
  | "validation"
  | "invalid-token"
  | "unknown";

export class MobileAuthError extends Error {
  readonly code: MobileAuthErrorCode;
  readonly status?: number;

  constructor(code: MobileAuthErrorCode, message: string, status?: number) {
    super(message);
    this.name = "MobileAuthError";
    this.code = code;
    this.status = status;
  }
}

/** Persian voice, mirroring the web auth forms. */
export const MOBILE_AUTH_MESSAGES: Record<MobileAuthErrorCode, string> = {
  unverified: "ایمیلت هنوز تأیید نشده؛ پیوندی که موقع ثبت‌نام فرستادیم را باز کن",
  "invalid-credentials": "ایمیل یا رمز اشتباه است",
  validation: "ایمیل یا رمز اشتباه است",
  "invalid-token": "این لینک معتبر نیست یا منقضی شده؛ یک لینک تازه بگیر.",
  unknown: "ارتباط با سرور برقرار نشد؛ دوباره تلاش کنید",
};

export interface MobileSessionUser {
  id: string;
  email: string;
}

export interface MobileSession {
  user: MobileSessionUser;
}

export interface MobileAuthClientOptions {
  /** better-auth mount; derived from the API base when omitted. */
  authBaseUrl?: string;
  apiBaseUrl?: string;
  fetchFn?: typeof fetch;
  tokenStore?: TokenStore;
}

/** Same normalization the web forgot form + API route apply (see src/lib/email). */
export function normalizeMobileEmail(email: string): string {
  return email.trim().toLowerCase();
}

interface AuthErrorBody {
  code?: string;
  message?: string;
}

async function readErrorBody(response: Response): Promise<AuthErrorBody> {
  try {
    const raw = (await response.json()) as unknown;
    if (typeof raw === "object" && raw !== null) return raw as AuthErrorBody;
  } catch {
    // Non-JSON error page — fall through to the generic mapping below.
  }
  return {};
}

function mapSignInFailure(status: number, body: AuthErrorBody): MobileAuthError {
  if (status === 403 && body.code === "EMAIL_NOT_VERIFIED")
    return new MobileAuthError("unverified", MOBILE_AUTH_MESSAGES.unverified, status);
  if (status === 401)
    return new MobileAuthError(
      "invalid-credentials",
      MOBILE_AUTH_MESSAGES["invalid-credentials"],
      status,
    );
  if (status === 400)
    return new MobileAuthError("validation", MOBILE_AUTH_MESSAGES.validation, status);
  return new MobileAuthError("unknown", MOBILE_AUTH_MESSAGES.unknown, status);
}

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

/** Bearer token arrives via the bearer plugin's set-auth-token header; some
 * builds also echo it in the JSON body — accept either. */
function extractBearerToken(response: Response, body: unknown): string | null {
  const header = response.headers.get("set-auth-token");
  if (header) return header;
  if (typeof body === "object" && body !== null) {
    const record = body as Record<string, unknown>;
    if (typeof record["token"] === "string" && record["token"]) return record["token"];
    const data = record["data"];
    if (typeof data === "object" && data !== null) {
      const nested = (data as Record<string, unknown>)["token"];
      if (typeof nested === "string" && nested) return nested;
    }
  }
  return null;
}

export function createMobileAuthClient(options: MobileAuthClientOptions = {}) {
  const authBaseUrl =
    options.authBaseUrl ?? resolveAuthBaseUrl(options.apiBaseUrl ?? "/api/v1");
  const doFetch = options.fetchFn ?? fetch;
  const tokenStore = options.tokenStore ?? createMemoryTokenStore();

  async function request(
    method: string,
    path: string,
    body?: unknown,
    token?: string | null,
  ): Promise<Response> {
    const headers: Record<string, string> = {};
    if (token) headers["authorization"] = `Bearer ${token}`;
    if (body !== undefined) {
      headers["content-type"] = "application/json";
    }
    return doFetch(`${authBaseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  return {
    /** The store behind this client (for restore-on-restart wiring). */
    tokenStore,

    getToken: () => tokenStore.getToken(),

    async signIn(input: { email: string; password: string }): Promise<MobileSession> {
      const email = normalizeMobileEmail(input.email);
      const response = await request("POST", "/sign-in/email", { email, password: input.password });
      if (!response.ok) throw mapSignInFailure(response.status, await readErrorBody(response));
      const body = await readJson<{ user: MobileSessionUser }>(response);
      const token = extractBearerToken(response, body);
      if (token) await tokenStore.setToken(token);
      return { user: body.user };
    },

    /** Sign-up never signs in: the account stays unverified until the emailed
     * link is opened (requireEmailVerification, same as web). Any 2xx means
     * "check your email" — a token is never stored here by design. */
    async signUp(input: {
      email: string;
      password: string;
      name?: string;
    }): Promise<{ needsVerification: boolean }> {
      const email = normalizeMobileEmail(input.email);
      const response = await request("POST", "/sign-up/email", {
        email,
        password: input.password,
        name: input.name ?? email.split("@")[0] ?? email,
      });
      if (!response.ok) throw mapSignInFailure(response.status, await readErrorBody(response));
      return { needsVerification: true };
    },

    /** Resend the verification email (the unverified-block escape hatch).
     * Transport/server failures surface; the server itself answers
     * generically (no enumeration). */
    async resendVerification(input: { email: string }): Promise<void> {
      const response = await request("POST", "/send-verification-email", {
        email: normalizeMobileEmail(input.email),
      });
      if (!response.ok)
        throw new MobileAuthError("unknown", MOBILE_AUTH_MESSAGES.unknown, response.status);
    },

    /** Always resolves generically (anti-enumeration, like web) — unless the
     * request itself fails, which surfaces instead of a false "sent" note. */
    async requestPasswordReset(input: { email: string }): Promise<void> {
      // redirectTo stays the same-origin web path: the emailed link must be
      // minted by the existing mechanism (frozen API), and the web
      // /reset-password page completes it. Routing that link into the app
      // (universal/deep links) is later-ticket work, not this shell.
      const response = await request("POST", "/request-password-reset", {
        email: normalizeMobileEmail(input.email),
        redirectTo: "/reset-password",
      });
      if (!response.ok)
        throw new MobileAuthError("unknown", MOBILE_AUTH_MESSAGES.unknown, response.status);
    },

    async resetPassword(input: { newPassword: string; token: string }): Promise<void> {
      const response = await request("POST", "/reset-password", {
        newPassword: input.newPassword,
        token: input.token,
      });
      if (!response.ok) {
        if (response.status === 400 || response.status === 401 || response.status === 403)
          throw new MobileAuthError(
            "invalid-token",
            MOBILE_AUTH_MESSAGES["invalid-token"],
            response.status,
          );
        throw new MobileAuthError("unknown", MOBILE_AUTH_MESSAGES.unknown, response.status);
      }
    },

    /** Null when signed out (no network); the Bearer session otherwise. */
    async getSession(): Promise<MobileSession | null> {
      const token = await tokenStore.getToken();
      if (!token) return null;
      const response = await request("GET", "/get-session", undefined, token);
      if (!response.ok) return null;
      const body = await readJson<{ user: MobileSessionUser } | null>(response);
      if (!body) return null;
      return { user: body.user };
    },

    /** Revoke server-side, then always clear the local token (revocable yet
     * safe: an offline sign-out still signs out locally). */
    async signOut(): Promise<void> {
      const token = await tokenStore.getToken();
      try {
        await request("POST", "/sign-out", {}, token);
      } catch {
        // Offline or unreachable: the local clear below is the essential
        // effect; the 7-day server session simply expires on its own.
      } finally {
        await tokenStore.clearToken();
      }
    },
  };
}

export type MobileAuthClient = ReturnType<typeof createMobileAuthClient>;
