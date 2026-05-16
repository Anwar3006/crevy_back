


/**
CONTRACT
Formalises long-term purchase commitments (offtake agreements)
between a partner/buyer and a project. Locks in quantities,
prices, and terms ahead of verification, giving project owners
revenue predictability and companies forward-carbon positions.
*/

import { uuidv7PK } from "@/shared/utils/id";
import { partner } from "../../partners/models/partner.model";
import { project } from "../../projects/models/project.model";
import { projectOwner } from "../../project_owners/models/project_owner.model";
import { projectPlot } from "../../projects/models/project-plot.model";
import { boolean, date, decimal, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

export const contractTypeEnum = pgEnum('contract_type_enum', [
    'project_of_ftake',
    'farmer_of_ftake',
    'spot_purchase',
    'credit_forward',
    'escrow_agreement',
    'interim_agreement'
]);

export const contractStatusEnum = pgEnum('contract_status_enum', [
    'draft',
    'active',
    'inactive',
    'completed',
    'terminated',
    'on_hold'
]);

export const contract = pgTable('contract',{
    id:                    uuid('id').primaryKey().$defaultFn(uuidv7PK),
    partnerId:             integer('partner_id').notNull().references(() => partner.id, { onDelete: 'restrict' }),
    projectId:             uuid('project_id').notNull().references(() => project.id, { onDelete: 'restrict' }),
    farmerId:              uuid('farmer_id').notNull().references(() => projectOwner.id, { onDelete: 'restrict' }),
    plotId:                    uuid('plot_id').notNull().references(() => projectPlot.id, { onDelete: 'restrict' }),

    contractRef:               varchar('contract_ref', { length: 100 }).notNull(), // e.g. CTR-2026-001
    contractType:              contractTypeEnum('contract_type').notNull(),
    contractTerms:             text('contract_terms'),
    startDate:                 date('start_date').notNull(),
    endDate:                   date('end_date'),
    status:                    contractStatusEnum('status').notNull().default('draft'),
    committedCredits:          decimal('committed_credits', { precision: 12, scale: 2 }),  // Total tCO₂e committed over the contract term
    carbonEstimated:           decimal('carbon_estimated', { precision: 12, scale: 2 }),  // Estimated carbon at the time of signing
    methodology:               varchar('methodology', { length: 100 }),
    paymentTerms:              jsonb(),
    hasDataSharingAgreement: boolean('has_data_sharing_agreement').notNull().default(false),

    createdAt:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:             timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
        uniqueIndex('idx_contract_ref').on(t.contractRef),
        uniqueIndex('idx_contract_ref_project').on(t.contractRef,t.projectId),
        index('idx_contract_type').on(t.contractType),
        index('idx_contract_status').on(t.status),
        index('idx_contract_methodology').on(t.methodology),
    ]
);