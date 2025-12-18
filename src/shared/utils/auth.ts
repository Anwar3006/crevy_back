import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { openAPI } from "better-auth/plugins";
import { db } from "@/config/db"; // your drizzle instance
import settings from "@/config/settings";

export const auth = betterAuth({
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
        required: true,
        input: true,
      },
      contactNumber: {
        type: "string",
        required: false,
        input: true,
      },
      countryOfOperation: {
        type: "string",
        required: false,
        input: true,
      },
      userType: {
        type: "string",
        required: true,
        input: true,
      },
    },
  },
  plugins: [openAPI()],
});
