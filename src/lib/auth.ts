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
    // Ticket 08/29: 1-hour reset tokens; the callback prints the link in
    // dev (zero external calls) and sends a Persian RTL email via Resend
    // only in prod (provisioning: ticket 16).
    resetPasswordTokenExpiresIn: 3600,
    sendResetPassword: async ({ user, url }) => {
      if (!process.env.RESEND_API_KEY) {
        console.log(`[auth] password reset link for ${user.email}: ${url}`);
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
          to: user.email,
          subject: "بازیابی رمز دفتر هزینه",
          html: `<div dir="rtl" lang="fa"><p>برای تعیین رمز تازه روی پیوند زیر بزنید (یک ساعت اعتبار دارد):</p><p><a href="${url}">تعیین رمز تازه</a></p></div>`,
        }),
      });
      if (!res.ok) throw new Error(`Resend rejected the reset email (${res.status})`);
    },
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
  plugins: [
    bearer(), // mobile path: set-auth-token header + Authorization: Bearer (ticket 08)
    nextCookies(), // must stay last
  ],
});
