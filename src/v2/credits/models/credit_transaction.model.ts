import { pgTable, pgEnum, uuid, varchar, decimal, boolean, integer, text, timestamp, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { currency } from '../../deps/models/currency.model'
import { uuidv7PK } from '@/shared/utils/id'


export const transactionStatusEnum = pgEnum('transaction_status_enum', ['pending', 'completed', 'failed', 'refunded'])

/**
 * credit_transaction
 * Crevy's immutable sales ledger. One transaction covers a batch of credits.
 * total_amount is stored (denormalised) at transaction time — never recomputed.
 * is_internal_sale = FALSE: real sale → triggers projectOwner payout + platform fee.
 * is_internal_sale = TRUE:  administrative transfer (buffer pool, retirement) → no money movement.
 */
export const creditTransaction = pgTable('credit_transaction', {
  id:                 uuid('id').primaryKey().$defaultFn(uuidv7PK),
  transactionRef:     varchar('transaction_ref', { length: 100 }).notNull().unique(),
  buyerId:            text('buyer_id').notNull(),   // FK → user.id
  sellerId:           text('seller_id').notNull(),  // FK → user.id
  isInternalSale:     boolean('is_internal_sale').notNull().default(false),
  quantity:           decimal('quantity',          { precision: 12, scale: 2 }).notNull(),
  pricePerCredit:     decimal('price_per_credit',  { precision: 10, scale: 2 }).notNull(),
  totalAmount:        decimal('total_amount',      { precision: 15, scale: 2 }).notNull(),
  currencyId:         integer('currency_id').notNull().references(() => currency.id, { onDelete: 'restrict' }),
  transactionStatus:  transactionStatusEnum('transaction_status').notNull().default('pending'),
  transactionDate:    timestamp('transaction_date', { withTimezone: true }).notNull().defaultNow(),
  notes:              text('notes'),
  createdAt:          timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_credit_txn_buyer').on(t.buyerId),
  index('idx_credit_txn_seller').on(t.sellerId),
  index('idx_credit_txn_status').on(t.transactionStatus),
])

export const creditTransactionRelations = relations(creditTransaction, ({ one }) => ({
  currency: one(currency, { fields: [creditTransaction.currencyId], references: [currency.id] }),
}))