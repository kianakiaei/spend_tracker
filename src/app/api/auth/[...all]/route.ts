import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { withNormalizedResetEmail } from "@/lib/auth-request";

const { GET, POST: betterAuthPOST } = toNextJsHandler(auth);

export { GET };

// Password-reset emails are looked up by raw input inside better-auth, so a
// capitalized/padded address misses the account and no email goes out.
// Normalize that one endpoint here; everything else delegates untouched.
export function POST(request: Request) {
  return withNormalizedResetEmail(request).then((req) => betterAuthPOST(req));
}
