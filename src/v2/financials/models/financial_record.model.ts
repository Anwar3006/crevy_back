import { pgTable, pgEnum, uuid, varchar, decimal, timestamp, integer, text, index, date } from 'drizzle-orm/pg-core'
import { uuidv7PK } from '@/shared/utils/id'
import { creditTransaction } from '../../credits/models/credit_transaction.model'
import { currency } from '../../deps/models/currency.model'

/**
General-purpose platform ledger for all financial events
beyond direct farmer payouts: platform fees, partner
commissions, refunds, contract escrow entries, and
corrective accounting adjustments. Together with
farmer_payout and credit_transaction, this gives Crevy
a complete financial audit trail.
*/
export const recordTypeEnum = pgEnum('record_type_enum', [
    'platform_fee',
    'refund',
    'contract_payment',
    'commission',
    'correction',
])

export const financialRecord = pgTable('financial_record', {
    id:             uuid('id').primaryKey().$defaultFn(uuidv7PK),
    transactionId:  uuid('transaction_id').notNull().references(() => creditTransaction.id, { onDelete: 'restrict' }),
    recordType:     recordTypeEnum('record_type').notNull(),
    amount:         decimal('amount', { precision: 12, scale: 2 }).notNull(),
    currencyId:     integer('currency_id').notNull().references(() => currency.id, { onDelete: 'set null' }),
    date:           date('date').notNull(),
    notes:          text('notes'),
    createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:      timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
    index('idx_financial_record_transaction').on(t.transactionId),
    index('idx_financial_record_type').on(t.recordType),
    index('idx_financial_record_date').on(t.date),
])