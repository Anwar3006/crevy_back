import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { openAPI } from "better-auth/plugins";
import { db } from "@/config/db";
import settings from "@/config/settings";

export const auth = betterAuth({
  // ─── IMPORTANT ───────────────────────────────────────────────────────────────
  // BETTER_AUTH_URL must be the URL of THIS server (the backend / auth server),
  // NOT the frontend. BetterAuth uses it to build cookie domains, redirect URLs,
  // and to validate incoming requests. Pointing it at the frontend was the
  // primary cause of the post-login redirect loop.
  // ─────────────────────────────────────────────────────────────────────────────
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.FRONTEND_URL, // Must be: https://crevy-backend.onrender.com

  database: drizzleAdapter(db, {
    provider: "pg",
  }),

  emailAndPassword: {
    enabled: true,
    // Only enforce email verification in production AND only once you have a
    // working email-verification flow in the frontend. Leaving this as `true`
    // in production without that flow silently blocks all sign-ins.
    requireEmailVerification: false,
  },

  socialProviders: {},

  user: {
    additionalFields: {
      firstName: {
        type: "string",
        required: true,
        input: true,
      },
      lastName: {
        type: "string",
        required: true,
        input: true,
      },
      userName: {
        type: "string",
        required: false,
        input: true,
      },
      contactNumber: {
        type: "string",
        required: false,
        input: true,
        returned: true,
      },
      countryOfOperation: {
        type: "string",
        required: false,
        input: true,
        returned: true,
      },
      userType: {
        type: "string",
        required: true,
        input: true,
        returned: true,
      },
      profileCompleted: {
        type: "boolean",
        required: false,
        input: true,
      },
      deletedAt: {
        type: "date",
        required: false,
        input: true,
      },
    },
  },

  trustedOrigins: [
    "http://localhost:3000",
    "https://crevy-frontend.vercel.app",
    "https://bx9dscmp-3000.uks1.devtunnels.ms",
    "https://crevy-frontend.netlify.app",
    settings.FRONTEND_URL,
  ],

  // ─── IMPORTANT ───────────────────────────────────────────────────────────────
  // `cookieOptions` is NOT a valid top-level BetterAuth key — it was previously
  // silently ignored, meaning sameSite:"none" was never applied.
  // The correct API is `advanced.defaultCookieAttributes`.
  //
  // sameSite:"none" + secure:true are REQUIRED for cross-origin cookies between
  // crevy-backend.onrender.com and crevy-frontend.netlify.app.
  // ─────────────────────────────────────────────────────────────────────────────
  advanced: {
    defaultCookieAttributes: {
      sameSite: "lax", // Required: frontend and backend are on different domains
      secure: true, // Required: sameSite:none only works over HTTPS
      httpOnly: true, // Security: prevents JS access to session cookie
    },
  },

  plugins: [openAPI()],
});
