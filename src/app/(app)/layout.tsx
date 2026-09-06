// The app shell (ticket 26): RTL paper with a whisper-quiet header. The
// inline-end slot stays EMPTY for now — the session email + خروج land there
// with ticket 29; /login (also 29) sits outside this route group on purpose.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex w-full max-w-[680px] items-center justify-between px-6 pt-5">
        <span className="text-[13.5px] font-semibold">دفتر هزینه</span>
        {/* جای ایمیل / خروج — تیکت ۲۹ */}
        <span />
      </header>
      <main>{children}</main>
    </div>
  );
}
