import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { openAPI } from "better-auth/plugins";
import { db } from "@/config/db";
import settings from "@/config/settings";

export const auth = betterAuth({
  /**
   * baseURL MUST be the URL of your frontend because you are using
   * Next.js rewrites to proxy /api/auth requests to the backend.
   * Browser-side, Better Auth thinks it lives at the frontend domain.
   */
  baseURL: `${settings.FRONTEND_URL}/api/auth`,
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
    "https://bx9dscmp-3000.uks1.devtunnels.ms",
    "https://crevy-frontend.netlify.app",
    settings.FRONTEND_URL,
  ],

  /**
   * When using a reverse proxy (Netlify rewrites), we must trust
   * the X-Forwarded-* headers to prevent redirection loops and
   * ensure cookies are set correctly.
   */
  advanced: {
    trustProxy: true,
    defaultCookieAttributes: {
      sameSite: "lax", // Proxied requests appear as same-site to the browser
      secure: true,
      httpOnly: true,
    },
  },

  plugins: [openAPI()],
});
