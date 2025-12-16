import { defineConfig } from "drizzle-kit";

console.log("DB_URL: ", process.env.DATABASE_URL);

export default defineConfig({
  out: "./drizzle",
  schema: "./src/v1/schema.ts", //modified to point to the schema file that exports all models
  casing: "snake_case",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
