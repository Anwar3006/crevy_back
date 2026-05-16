import { pgTable, pgEnum, uuid, varchar, decimal, smallint, date, text, timestamp, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { project } from '../../projects/models/project.model'
import { mrvBlockchainAnchor } from '../../mrv/models/mrv_blockchain.model'
import { uuidv7PK } from '@/shared/utils/id'
import { creditTransaction } from './credit_transaction.model'


export const creditStatusEnum = pgEnum('credit_status_enum', ['available', 'reserved', 'sold', 'retired', 'invalidated'])

/**
 * carbon_credit - using the UTXO model
 * One row = one tCO₂e. Individually serialised so the full chain of custody
 * from issuance to retirement is traceable.
 *
 * HOW CREDITS ARE ISSUED (Batch-Based Model):
 * 1. CraftedClimate Worker 3 webhook fires with verification_status=SUCCESS.
 * 2. MrvService reads net_credits_issued (e.g., 20.0 tCO₂e).
 * 3. CreditService creates ONE row here with total_amount = 20.0 and available_amount = 20.0.
 * 4. The row stores the serial number range (e.g., CC-1001 to CC-1020).
 * 5. current_owner_id is set to the project's primary farmer.
 *
 * HOW BUYING / SPLITTING WORKS:
 * If a buyer purchases 5.0 credits from this batch:
 * 1. The original row is updated: available_amount = 15.0.
 * 2. A new row is inserted for the buyer:
 *    - total_amount = 5.0, available_amount = 5.0
 *    - current_owner_id = buyer_user_id
 *    - The serial numbers are logically split, or we just track the allocation
 *      against the original mrv_batch_id.
 *
 * DATE SEQUENCE (chronological order):
 *   generation_date   → end of sensor measurement period (carbon physically removed)
 *   verification_date → CraftedClimate Worker 2 SUCCESS timestamp
 *   issuance_date     → when this credit row was created on Crevy
 */
export const carbonCredit = pgTable('carbon_credit', {
  id:                  uuid('id').primaryKey().$defaultFn(uuidv7PK),
  projectId:           uuid('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
  
  // Serial range for traceability without row bloat (e.g., 'GH-2026-0001' to 'GH-2026-0020')
  serialNumberStart:   varchar('serial_number_start', { length: 100 }).notNull(),
  serialNumberEnd:     varchar('serial_number_end', { length: 100 }).notNull(),
  
  // Amounts: total_amount = how much was in this specific split/batch. 
  // available_amount = how much is left to sell/retire.
  totalAmount:         decimal('total_amount', { precision: 12, scale: 6 }).notNull(),
  availableAmount:     decimal('available_amount', { precision: 12, scale: 6 }).notNull(),
  
  creditVintage:       smallint('credit_vintage').notNull(),
  creditStatus:        creditStatusEnum('credit_status').notNull().default('available'),
  mrv_batch_id:        varchar('mrv_batch_id', { length: 100 }).notNull()
                         .references(() => mrvBlockchainAnchor.batchId, { onDelete: 'restrict' }),
  blockchainTxHash:    varchar('blockchain_tx_hash', { length: 255 }).notNull(),
  currentOwnerId:      text('current_owner_id').notNull(), // FK → user.id
  registry:            varchar('registry', { length: 100 }),
  generationDate:      date('generation_date'),
  verificationDate:    date('verification_date'),
  issuanceDate:        date('issuance_date'),
  transactionId:       uuid('transaction_id').references(() => creditTransaction.id, { onDelete: 'set null' }),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_carbon_credit_project').on(t.projectId),
  index('idx_carbon_credit_status').on(t.creditStatus),
  index('idx_carbon_credit_owner').on(t.currentOwnerId),
  index('idx_carbon_credit_vintage').on(t.creditVintage),
  index('idx_carbon_credit_batch').on(t.mrv_batch_id),
])