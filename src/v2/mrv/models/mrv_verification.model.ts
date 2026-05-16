import { pgTable, pgEnum, uuid, varchar, decimal, boolean, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { mrvIngestionEvent } from './mrv_ingestion.model'
import { project } from '@/v2/projects/models/project.model'
import { uuidv7PK } from '@/shared/utils/id'

export const verificationStatusEnum = pgEnum('verification_status_enum', ['success', 'flagged', 'failed'])
export const geoFenceStatusEnum     = pgEnum('geo_fence_status_enum',    ['valid', 'invalid'])

/**
 * mrv_verification_result
 * Stores CraftedClimate Worker 2 webhook payload.
 * This is the DEFINITIVE scientific verdict that authorises credit issuance.
 *
 * CONSERVATISM PRINCIPLE: Always use net_credits_issued for issuance.
 * NEVER use gross_removals_tco2e — it has not had leakage or buffer deducted.
 * gross_removals_tco2e is stored for display/audit purposes only.
 *
 * If verification_status = 'flagged': carbon_accounting fields will be null.
 * No credits can be issued for a flagged batch.
 */
export const mrvVerificationResult = pgTable('mrv_verification_result', {
  id:                   uuid('id').primaryKey().$defaultFn(uuidv7PK),
  ingestionId:          uuid('ingestion_id').notNull().references(() => mrvIngestionEvent.id, { onDelete: 'cascade' }),
  projectId:            uuid('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
  verificationEventId:  varchar('verification_event_id', { length: 200 }).notNull().unique(),
  methodologyApplied:   varchar('methodology_applied', { length: 100 }),
  verificationStatus:   verificationStatusEnum('verification_status').notNull(),
  // AI model fields from Worker 2
  aiModelId:            varchar('ai_model_id', { length: 100 }),
  aiConfidenceScore:    decimal('ai_confidence_score', { precision: 5, scale: 4 }),
  isAnomalous:          boolean('is_anomalous').notNull().default(false),
  predictionClass:      varchar('prediction_class', { length: 100 }),
  // Spatial and hardware integrity
  geoFenceStatus:       geoFenceStatusEnum('geo_fence_status').notNull(),
  hardwareIntegrity:    varchar('hardware_integrity', { length: 50 }).notNull(),
  // Carbon accounting (null when flagged)
  grossRemovalsTco2e:   decimal('gross_removals_tco2e', { precision: 12, scale: 6 }),
  leakageDeduction:     decimal('leakage_deduction',    { precision: 12, scale: 6 }),
  bufferContribution:   decimal('buffer_contribution',  { precision: 12, scale: 6 }),
  netCreditsIssued:     decimal('net_credits_issued',   { precision: 12, scale: 6 }),  // ← USE THIS
  receivedAt:           timestamp('received_at', { withTimezone: true }),
})

export const mrvVerificationResultRelations = relations(mrvVerificationResult, ({ one }) => ({
  ingestionEvent: one(mrvIngestionEvent, { fields: [mrvVerificationResult.ingestionId], references: [mrvIngestionEvent.id] }),
  project:        one(project,           { fields: [mrvVerificationResult.projectId],   references: [project.id] }),
}))