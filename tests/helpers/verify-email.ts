import type { auth as authInstance } from "@/lib/auth";

// Sign-up no longer signs in: tests must open the emailed verification
// link first. better-auth mints a signed JWT (no DB row), so like the
// password-reset test we capture the dev console line and open it through
// the real handler. Takes the test file's own `auth` (dynamic import AFTER
// its env is set) — never imported statically.

type Auth = typeof authInstance;

export function captureConsoleLines(): {
  lines: string[];
  restore: () => void;
} {
  const lines: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => {
    lines.push(String(args[0]));
  };
  return { lines, restore: () => void (console.log = original) };
}

export function emailedUrl(lines: string[], label: string): string {
  const match = lines.join("\n").match(/https?:\/\/\S+/);
  if (!match) throw new Error(`expected the dev ${label} link in console`);
  const parsed = new URL(match[0]);
  return `http://localhost:3000${parsed.pathname}${parsed.search}`;
}

/** Opens a verification link and returns the session cookie it sets. */
export async function verifyEmail(
  auth: Auth,
  url: string,
): Promise<{ cookie: string; status: number }> {
  const res = await auth.handler(new Request(url));
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  return { cookie, status: res.status };
}
