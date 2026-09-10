import { normalizeEmail } from "@/lib/email";

/** Rewrite a request-password-reset POST so its email is normalized
 * (trim + lowercase) before better-auth looks the user up.
 *
 * Sign-up stores emails lowercased, but better-auth 1.7 looks up the reset
 * request with the raw input — a capitalized/padded email then misses the
 * account and the endpoint returns its generic "if registered…" message
 * without ever calling sendResetPassword. Normalizing here (rather than
 * only in the web form) also fixes mobile clients and raw API calls, which
 * share this same endpoint. Non-reset paths pass through untouched, and any
 * unparsable body is forwarded as-is for better-auth to validate. */
export async function withNormalizedResetEmail(
  request: Request,
): Promise<Request> {
  if (!new URL(request.url).pathname.endsWith("/request-password-reset")) {
    return request;
  }
  try {
    const body = (await request.clone().json()) as {
      email?: unknown;
    } & Record<string, unknown>;
    if (typeof body?.email === "string") {
      const normalized = normalizeEmail(body.email);
      if (normalized !== body.email) {
        return new Request(request, {
          body: JSON.stringify({ ...body, email: normalized }),
        });
      }
    }
  } catch {
    // Fall through with the original request.
  }
  return request;
}
