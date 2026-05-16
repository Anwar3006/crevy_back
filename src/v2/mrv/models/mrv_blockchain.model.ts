import { relations } from 'drizzle-orm'
import { pgTable, uuid, varchar, bigint, smallint, timestamp } from 'drizzle-orm/pg-core'
import { uuidv7PK } from '@/shared/utils/id'
import { project } from '@/v2/projects/models/project.model'
import { mrvVerificationResult } from './mrv_verification.model'

/**
 * mrv_blockchain_anchor
 * Stores CraftedClimate Worker 3 webhook payload.
 * transaction_hash: immutable Polygon proof. Share with auditors.
 * audit_uri: IPFS CID — permanent public audit record.
 * batch_id: groups all carbon_credit rows issued from this anchor.
 *
 * These two fields are what a corporate auditor needs to independently verify
 * a credit WITHOUT trusting Crevy: transaction_hash + audit_uri.
 */
export const mrvBlockchainAnchor = pgTable('mrv_blockchain_anchor', {
  id:              uuid('id').primaryKey().$defaultFn(uuidv7PK),
  resultId:        uuid('result_id').notNull().unique().references(() => mrvVerificationResult.id, { onDelete: 'cascade' }),
  projectId:       uuid('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
  network:         varchar('network', { length: 100 }).notNull(),
  contractAddress: varchar('contract_address', { length: 100 }).notNull(),
  transactionHash: varchar('transaction_hash', { length: 255 }).notNull().unique(),
  blockHeight:     bigint('block_height', { mode: 'number' }),
  batchId:         varchar('batch_id', { length: 100 }).notNull().unique(),
  vintage:         smallint('vintage').notNull(),
  merkleRoot:      varchar('merkle_root', { length: 255 }).notNull(),
  auditUri:        varchar('audit_uri', { length: 500 }).notNull(),
  anchoredAt:      timestamp('anchored_at', { withTimezone: true }),
})

export const mrvBlockchainAnchorRelations = relations(mrvBlockchainAnchor, ({ one }) => ({
  verificationResult: one(mrvVerificationResult, { fields: [mrvBlockchainAnchor.resultId],   references: [mrvVerificationResult.id] }),
  project:            one(project,               { fields: [mrvBlockchainAnchor.projectId],  references: [project.id] }),
}))