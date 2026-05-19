// src/v2/deps/services/currency.service.ts
import { db } from "@/config/db";
import { currency } from "../models/currency.model";
import { eq } from "drizzle-orm";

const CurrencyService = {
  getAll: async () => {
    return await db.select().from(currency);
  },

  getById: async (id: number) => {
    const [existing] = await db
      .select()
      .from(currency)
      .where(eq(currency.id, id))
      .limit(1);
    return existing || null;
  },

  getOrCreate: async (code: string, name: string) => {
    // 1. Check if it exists
    const [existing] = await db
      .select()
      .from(currency)
      .where(eq(currency.code, code.toUpperCase()))
      .limit(1);

    if (existing) return existing;

    // 2. Insert if it doesn't exist
    const [newCurrency] = await db
      .insert(currency)
      .values({
        code: code.toUpperCase(),
        name,
      })
      .returning();

    return newCurrency;
  },

  upsert: async (code: string, name: string) => {
    // 1. Check if it exists by code
    const [existing] = await db
      .select()
      .from(currency)
      .where(eq(currency.code, code.toUpperCase()))
      .limit(1);

    if (existing) {
      // Update name
      const [updated] = await db
        .update(currency)
        .set({ name })
        .where(eq(currency.id, existing.id))
        .returning();
      return updated;
    }

    // 2. Insert new
    const [inserted] = await db
      .insert(currency)
      .values({
        code: code.toUpperCase(),
        name,
      })
      .returning();
    return inserted;
  },

  delete: async (id: number) => {
    const [deleted] = await db
      .delete(currency)
      .where(eq(currency.id, id))
      .returning();
    return deleted || null;
  },
};

export default CurrencyService;
