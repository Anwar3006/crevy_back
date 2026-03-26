import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { openAPI } from "better-auth/plugins";
import { db } from "@/config/db";
import settings from "@/config/settings";

export const auth = betterAuth({
  /**
   * baseURL MUST be the URL of your frontend because you are using
   * Next.js rewrites to proxy /api/auth requests to the backend.
   *
   * ─── CRITICAL: Set BETTER_AUTH_URL in Render env to the vercel URL ───
   * Example: https://crevy-frontend-yttg.vercel.app/api/auth
   * If this mismatching with your browser URL, Better Auth will redirect
   * and cause a loop.
   * ──────────────────────────────────────────────────────────────────
   */
  baseURL: process.env.BETTER_AUTH_URL || `${settings.FRONTEND_URL}/api/auth`,
  secret: process.env.BETTER_AUTH_SECRET,

  database: drizzleAdapter(db, {
    provider: "pg",
  }),

  emailAndPassword: {
    enabled: true,
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
    "https://crevy-frontend-yttg.vercel.app", // User Vercel instance
    "https://bx9dscmp-3000.uks1.devtunnels.ms",
    "https://crevy-frontend.netlify.app",
    settings.FRONTEND_URL,
  ],

  advanced: {
    /**
     * In Better Auth, trustProxy is required for the library to respect
     * the hostname and protocol from X-Forwarded-* headers when behind proxies.
     */
    trustProxy: true,
    defaultCookieAttributes: {
      sameSite: "lax", // Lax is safe since it is proxied on same-origin.
      secure: true,
      httpOnly: true,
    },
  },

  plugins: [openAPI()],
});
