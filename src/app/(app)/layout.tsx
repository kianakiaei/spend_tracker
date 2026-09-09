import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SignOutButton } from "@/components/auth/sign-out-button";

// The app shell (tickets 26/29): RTL paper with a whisper-quiet header. The
// layout guard is the authoritative session check (the proxy only looks for
// cookie presence — ticket 08); /login and the reset pages sit outside this
// route group on purpose.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex w-full max-w-[680px] items-center justify-between px-6 pt-5">
        <span className="text-[13.5px] font-semibold">دفتر هزینه</span>
        <span className="flex items-center gap-3">
          <span className="max-w-[220px] truncate text-[12.5px] text-ink-muted">
            {session.user.email}
          </span>
          <SignOutButton />
        </span>
      </header>
      <main>{children}</main>
    </div>
  );
}
