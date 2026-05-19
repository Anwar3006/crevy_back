// src/v2/deps/schemas/currency.schema.ts
import { z } from "zod";

export const UpsertCurrencySchema = z.object({
  body: z.object({
    code: z
      .string({ error: "Currency code is required" })
      .length(3, "Currency code must be exactly 3 characters")
      .transform((val) => val.toUpperCase()),
    name: z
      .string({ error: "Currency name is required" })
      .min(1, "Currency name cannot be empty")
      .max(50, "Currency name cannot exceed 50 characters"),
  }),
});

export const GetOrDeleteCurrencySchema = z.object({
  params: z.object({
    id: z
      .string({ error: "Currency ID is required" })
      .regex(/^\d+$/, "Currency ID must be a positive integer numeric string"),
  }),
});
