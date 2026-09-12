import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// The optimistic auth gate (ticket 08/25; the Next 16 successor of
// middleware.ts): checks COOKIE PRESENCE only — never a validation, the
// handlers and RSC guards are the authority — and bounces cookie-less
// browsers to /login.
//
// Deliberate exceptions (the matcher): /api/v1/* answers its own 401
// problem+json, /api/auth/* is better-auth's own mount, the public auth
// pages never gate (ticket 29 — otherwise /login loops on itself), and
// static assets never gate.
//
// Dev-only CORS for expo web (expo-mobile ticket 09 follow-up): the expo dev
// server (localhost:8081) is a different origin from Next (localhost:3000),
// so browser preflights would block every mobile call. The "/api/:path*"
// matcher entry below lets this proxy answer OPTIONS preflights and stamp
// CORS headers on API responses — gated on NODE_ENV=development, so the
// production wire is byte-identical (frozen API constraint). API calls are
// never login-redirected here: mobile authenticates with a Bearer token and
// carries no session cookie.

const DEV_WEB_ORIGINS = new Set(["http://localhost:8081", "http://127.0.0.1:8081"]);

function isDevApiRequest(request: NextRequest): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    request.nextUrl.pathname.startsWith("/api/")
  );
}

function withDevCors(request: NextRequest, response: NextResponse): NextResponse {
  const origin = request.headers.get("origin");
  if (origin && DEV_WEB_ORIGINS.has(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Vary", "Origin");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    response.headers.set("Access-Control-Max-Age", "86400");
  }
  return response;
}

export function proxy(request: NextRequest) {
  if (isDevApiRequest(request)) {
    if (request.method === "OPTIONS") {
      return withDevCors(request, new NextResponse(null, { status: 204 }));
    }
    return withDevCors(request, NextResponse.next());
  }
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/v1|api/auth|login|forgot-password|reset-password|_next/static|_next/image|_next/data|favicon.ico|robots.txt|sitemap.xml|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|mjs|map|txt|xml|woff|woff2|ttf)$).*)",
    "/api/:path*",
  ],
};
