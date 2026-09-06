import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// The optimistic auth gate (ticket 08/25; the Next 16 successor of
// middleware.ts): checks COOKIE PRESENCE only — never a validation, the
// handlers and RSC guards are the authority — and bounces cookie-less
// browsers to /login.
//
// Deliberate exceptions (the matcher): /api/v1/* answers its own 401
// problem+json, /api/auth/* is better-auth's own mount, and static assets
// never gate.

export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/v1|api/auth|_next/static|_next/image|_next/data|favicon.ico|robots.txt|sitemap.xml|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|mjs|map|txt|xml|woff|woff2|ttf)$).*)",
  ],
};
