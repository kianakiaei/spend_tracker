/** Lowercase + trim an email for lookup/storage.
 *
 * better-auth stores sign-up emails lowercased and lowercases on sign-in,
 * but its request-password-reset lookup uses the raw input — so
 * `User@Example.com` never matches the stored `user@example.com` and the
 * endpoint silently answers its generic message without sending anything.
 * Normalize on our side (form + API route) to close that gap. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
