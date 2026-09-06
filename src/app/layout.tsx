import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Vazirmatn variable (100..900) — self-hosted woff2 committed in the repo
// (ticket 26): no build-time fetch, no network dependency for the one font
// the whole UI runs on.
const vazirmatn = localFont({
  src: "./fonts/Vazirmatn-Variable.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-vazirmatn",
});

export const metadata: Metadata = {
  title: "دفتر هزینه",
  description: "مدیریت هزینهٔ ماهانه — جمع هر ماه جلالی به تفکیک دسته",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fa"
      dir="rtl"
      className={`${vazirmatn.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
