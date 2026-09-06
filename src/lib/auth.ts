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
