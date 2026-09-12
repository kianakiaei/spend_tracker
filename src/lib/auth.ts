import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import { account, session, user, verification } from "@/db/schema";
import { seedSystemCategories } from "@/lib/services/seed-system-categories";

// Session lifetime pinned by ticket 08: 7 days, sliding (refreshed daily).
const SESSION_7_DAYS = 60 * 60 * 24 * 7;
const SESSION_UPDATE_AGE_1_DAY = 60 * 60 * 24;

/** Dev prints the link (zero external calls); prod sends a Persian RTL
 * email via Resend. Shared by the reset and verification senders. */
async function sendEmailOrLog({
  to,
  subject,
  html,
  logLine,
}: {
  to: string;
  subject: string;
  html: string;
  logLine: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log(logLine);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM ?? "دفتر هزینه <no-reply@localhost>",
      to,
      subject,
      html,
    }),
  });
  if (!res.ok) {
    // The auth endpoints answer generically (anti-enumeration), so a
    // rejected send would otherwise be invisible — log it server-side.
    const detail = await res.text().catch(() => "");
    console.error(
      `[auth] Resend rejected "${subject}" to ${to} (${res.status}): ${detail}`,
    );
    throw new Error(`Resend rejected the email (${res.status})`);
  }
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user,
      session,
      account,
      verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    // Sign-up no longer signs in: the account stays unverified until the
    // emailed link is opened (the login form says so; unverified sign-ins
    // get 403 EMAIL_NOT_VERIFIED).
    requireEmailVerification: true,
    // Ticket 08/29: 1-hour reset tokens; the callback prints the link in
    // dev (zero external calls) and sends a Persian RTL email via Resend
    // only in prod (provisioning: ticket 16).
    resetPasswordTokenExpiresIn: 3600,
    sendResetPassword: async ({ user, url }) =>
      sendEmailOrLog({
        to: user.email,
        subject: "بازیابی رمز دفتر هزینه",
        html: `<div dir="rtl" lang="fa"><p>برای تعیین رمز تازه روی پیوند زیر بزنید (یک ساعت اعتبار دارد):</p><p><a href="${url}">تعیین رمز تازه</a></p></div>`,
        logLine: `[auth] password reset link for ${user.email}: ${url}`,
      }),
    // Taken email on sign-up: better-auth answers generically (200 + a
    // phantom user — anti-enumeration, no row, no verification mail) and
    // calls this hook with the REAL owner. The one place we can warn them
    // without changing the wire response: no verification is (re)sent, the
    // account is untouched, and the owner keeps signing in as before.
    // (Untyped in better-auth 1.7's declarations, hence the local shape.)
    onExistingUserSignUp: async ({ user }: { user: { email: string } }) => {
      try {
        await sendEmailOrLog({
          to: user.email,
          subject: "تلاش برای ثبت‌نام با ایمیل شما در دفتر هزینه",
          html: `<div dir="rtl" lang="fa"><p>کسی با این ایمیل درخواست ثبت‌نام تازه کرده است. اگر خودتان بودید و رمزتان را دارید، فقط وارد شوید — حساب شما هیچ تغییری نکرده و ایمیل تأییدی هم فرستاده نشده است. در غیر این صورت این پیام را نادیده بگیرید.</p></div>`,
          logLine: `[auth] duplicate sign-up warning for ${user.email}: account unchanged, no verification sent`,
        });
      } catch (error) {
        console.error(
          `[auth] duplicate sign-up warning failed for ${user.email}`,
          error,
        );
      }
    },
  },
  emailVerification: {
    // 1-hour tokens, same window as reset. The link signs the user in and
    // lands on / (its callbackURL).
    expiresIn: 3600,
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) =>
      sendEmailOrLog({
        to: user.email,
        subject: "تأیید ایمیل دفتر هزینه",
        html: `<div dir="rtl" lang="fa"><p>برای فعال شدن حسابت روی پیوند زیر بزن (یک ساعت اعتبار دارد):</p><p><a href="${url}">تأیید ایمیل</a></p></div>`,
        logLine: `[auth] verification link for ${user.email}: ${url}`,
      }),
  },
  databaseHooks: {
    user: {
      create: {
        // Six system categories, ready before the user's first visit
        // (ticket 19). Errors propagate: a user without categories is broken
        // and the sign-up should visibly fail.
        after: async (user) => {
          await seedSystemCategories(user.id);
        },
      },
    },
  },
  session: {
    expiresIn: SESSION_7_DAYS,
    updateAge: SESSION_UPDATE_AGE_1_DAY,
  },
  // Dev-only: expo web runs on a different origin (localhost:8081) than Next
  // (localhost:3000), and better-auth rejects unlisted origins with 403
  // "Invalid origin". Production keeps the default (baseURL origin only).
  trustedOrigins:
    process.env.NODE_ENV === "development"
      ? ["http://localhost:8081", "http://127.0.0.1:8081"]
      : [],
  plugins: [
    bearer(), // mobile path: set-auth-token header + Authorization: Bearer (ticket 08)
    nextCookies(), // must stay last
  ],
});
