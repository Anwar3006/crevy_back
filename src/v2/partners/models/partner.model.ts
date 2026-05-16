import { pgTable, pgEnum, serial, varchar, text, boolean, timestamp, integer } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { currency } from '@/v2/parent-model'


export const partnerTypeEnum   = pgEnum('partner_type_enum',   ['dMRV_provider', 'auditing_body', 'registry', 'channel'])
export const partnerStatusEnum = pgEnum('partner_status_enum', ['pending', 'approved', 'suspended', 'rejected'])

/**
 * partner
 * External organisations: CraftedClimate (dMRV provider), auditing bodies,
 * certification registries, and channel partners who onboard farmers.
 * CraftedClimate must be seeded as the first record after migration.
 */
export const partner = pgTable('partner', {
  id:                       serial('id').primaryKey(),
  name:                     varchar('name', { length: 255 }).notNull().unique(), //company_name
  partnerType:              partnerTypeEnum('partner_type').notNull(),
  contactPerson:            text('contact_person').notNull(),           // contact_person_name
  contactEmail:             text('contact_email').notNull(),
  contactPhone:             varchar('contact_phone', { length: 50 }),
  country:                  varchar('country', { length: 100 }),
  status:                   partnerStatusEnum('status').notNull().default('pending'),
  defaultCurrencyId:        integer('default_currency_id').references(() => currency.id, { onDelete: 'set null' }),
  hasDataSharingAgreement:  boolean('has_data_sharing_agreement').notNull().default(false),
  createdAt:                timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const partnerRelations = relations(partner, ({ one }) => ({
  currency: one(currency, { fields: [partner.defaultCurrencyId], references: [currency.id] }),
}))
