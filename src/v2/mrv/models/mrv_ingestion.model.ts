import { pgEnum, pgTable, uuid, varchar, timestamp, integer } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { uuidv7PK } from '@/shared/utils/id'
import { project } from '@/v2/projects/models/project.model'
import { partner } from '@/v2/partners/models/partner.model'
import { farmPlot, projectOwner } from '@/v2/parent-model'

export const mrvIngestionStatusEnum = pgEnum('mrv_ingestion_status_enum', ['pending', 'processing', 'verified', 'flagged', 'failed'])

/**
 * mrv_ingestion_event
 * Crevy's tracking record for every dMRV batch submitted to CraftedClimate.
 * cc_ingestion_id: CraftedClimate's msg-ingest-uuid-XXXXX — used to correlate
 * webhook callbacks back to this record.
 * This table is the translation layer: CraftedClimate knows its device_id and CC project ID;
 * Crevy knows its plot_id and project UUID. This table maps between them.
 */
export const mrvIngestionEvent = pgTable('mrv_ingestion_event', {
  id:                   uuid('id').primaryKey().$defaultFn(uuidv7PK),
  ccIngestionId:        varchar('cc_ingestion_id', { length: 100 }).notNull().unique(),
  projectId:            uuid('project_id').notNull().references(() => project.id,   { onDelete: 'cascade' }),
  plotId:               uuid('plot_id').notNull().references(() => farmPlot.id,  { onDelete: 'cascade' }),
  projectOwnerId:       uuid('project_owner_id').notNull().references(() => projectOwner.id,   { onDelete: 'cascade' }),
  partnerId:            integer('partner_id').notNull().references(() => partner.id, { onDelete: 'restrict' }),
  deviceId:             varchar('device_id', { length: 100 }),
  submissionTimestamp:  timestamp('submission_timestamp', { withTimezone: true }),
  ingestionStatus:      mrvIngestionStatusEnum('ingestion_status').notNull().default('pending'),
  createdAt:            timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const mrvIngestionEventRelations = relations(mrvIngestionEvent, ({ one }) => ({
  project:        one(project,        { fields: [mrvIngestionEvent.projectId],        references: [project.id] }),
  farmPlot:       one(farmPlot,       { fields: [mrvIngestionEvent.plotId],           references: [farmPlot.id] }),
  projectOwner:   one(projectOwner,   { fields: [mrvIngestionEvent.projectOwnerId],   references: [projectOwner.id] }),
  partner:        one(partner,        { fields: [mrvIngestionEvent.partnerId],        references: [partner.id] }),
}))