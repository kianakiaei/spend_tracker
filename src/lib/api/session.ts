import { auth } from "@/lib/auth";
import { problem } from "./problem";

// Session resolution for the v1 handlers (ticket 25): `auth.api.getSession`
// with the request's own headers — the web cookie and the mobile
// `Authorization: Bearer` (bearer plugin, ticket 18) are both transparent.
// No session = the 401 problem+json; ownership checks stay in the services.

export async function requireUserId(request: Request): Promise<string> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    throw problem("unauthorized", "sign in to use the v1 API");
  }
  return session.user.id;
}
