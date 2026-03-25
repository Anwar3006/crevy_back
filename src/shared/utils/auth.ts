import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { openAPI } from "better-auth/plugins";
import { db } from "@/config/db"; // your drizzle instance
import settings from "@/config/settings";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,

  database: drizzleAdapter(db, {
    provider: "pg", // or "mysql", "sqlite"
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: settings.NODE_ENV === "production",
  },

  socialProviders: {
    // google: {},
  }, // Add your social providers here
  // Extend the user schema with your custom fields
  user: {
    additionalFields: {
      firstName: {
        type: "string",
        required: true,
        input: true, // Accept this field during sign-up
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
  ],

  cookieOptions: {
    sameSite: "none", // Required for cross-site cookies if domains differ
    secure: true, // Must be true if sameSite is "none"
  },

  plugins: [openAPI()],
});
