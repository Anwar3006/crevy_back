import { pgTable, uuid, integer, varchar, date, text, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { project } from '../../projects/models/project.model'
import { partner } from '../../partners/models/partner.model'
import { verificationStatusEnum } from '../../mrv/models/mrv_verification.model'


/**
 * verification
 * Crevy's business-layer record of each formal verification outcome.
 * References CraftedClimate as the verifying partner (verifier_partner_id).
 * verification_event_id is CraftedClimate's v-verify-uuid-XXXXX — correlates back
 * to mrv_verification_result and CraftedClimate's own audit logs.
 * A project accumulates multiple verifications over its lifetime (one per dMRV cycle).
 */
export const creditVerification = pgTable('credit_verification', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  projectId:            uuid('project_id').notNull().references(() => project.id,  { onDelete: 'cascade' }),
  verifierPartnerId:    integer('verifier_partner_id').notNull().references(() => partner.id, { onDelete: 'restrict' }),
  verificationEventId:  varchar('verification_event_id', { length: 200 }).notNull().unique(),
  methodologyApplied:   varchar('methodology_applied', { length: 100 }),
  verificationDate:     date('verification_date').notNull(),
  verificationStatus:   verificationStatusEnum('verification_status').notNull(),
  verificationNotes:    text('verification_notes'),
  createdAt:            timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const creditVerificationRelations = relations(creditVerification, ({ one }) => ({
  project: one(project, { fields: [creditVerification.projectId],         references: [project.id] }),
  partner: one(partner, { fields: [creditVerification.verifierPartnerId], references: [partner.id] }),
}))
