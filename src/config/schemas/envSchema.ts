import { EEnvironment } from "@shared/types";
import { z as zod } from "zod";

export const EnvSchema = zod.object({
  APP_PORT: zod.string({
    error: "APP_PORT is missing in the .env file",
  }),
  // The docker compose file provides
  // a default value of development
  // for this attribute.
  NODE_ENV: zod.enum(EEnvironment, {
    error: "NODE_ENV must be provided in the .env file",
  }),
  DATABASE_URL: zod.string({
    error: "DATABASE_URL must be provided in the .env file",
  }),
});
