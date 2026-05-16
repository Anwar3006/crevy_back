import { pgTable, serial, char, varchar, timestamp } from 'drizzle-orm/pg-core'

/**
 * currency
 * ISO 4217 reference table. Every monetary field in the system links here.
 * Seeded on migration: USD, GHS, EUR, KES, NGN, ZAR.
 */
export const currency = pgTable('currency', {
  id:        serial('id').primaryKey(),
  code:      char('code', { length: 3 }).notNull().unique(),   // e.g. USD, GHS
  name:      varchar('name', { length: 50 }).notNull().unique(), // e.g. US Dollar
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
