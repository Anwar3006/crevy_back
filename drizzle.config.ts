import { defineConfig } from "drizzle-kit";

// Load environment variables from .env file
try {
  process.loadEnvFile();
} catch (e) {
  // .env file might not exist in some environments, which is fine if env vars are already set
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is not set");
}

export default defineConfig({
  out: "./drizzle",
  schema: "./src/v1/schema.ts", //modified to point to the schema file that exports all models
  casing: "snake_case",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
