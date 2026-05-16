// src/v2/financials/schemas/financials.schema.ts
import { z } from "zod";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const ContractTypeSchema = z.enum([
  'project_of_ftake',
  'farmer_of_ftake',
  'spot_purchase',
  'credit_forward',
  'escrow_agreement',
  'interim_agreement'
]);

export const ContractStatusSchema = z.enum([
  'draft',
  'active',
  'inactive',
  'completed',
  'terminated',
  'on_hold'
]);

export const PayoutMethodSchema = z.enum(['mobile_money', 'bank_transfer', 'cash']);
export const PayoutStatusSchema = z.enum(['pending', 'completed', 'failed']);

export const RecordTypeSchema = z.enum([
  'platform_fee',
  'refund',
  'contract_payment',
  'commission',
  'correction',
]);

// ─── Contract ────────────────────────────────────────────────────────────────

export const CreateContractSchema = z.object({
  body: z.object({
    partnerId:               z.number().int().positive(),
    projectId:               z.string().uuid(),
    farmerId:                z.string().uuid(),
    plotId:                  z.string().uuid(),
    contractRef:             z.string().min(1),
    contractType:            ContractTypeSchema,
    contractTerms:           z.string().optional(),
    startDate:               z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
    endDate:                 z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").optional(),
    status:                  ContractStatusSchema.default('draft'),
    committedCredits:        z.string().regex(/^\d+(\.\d{1,2})?$/, "Must be a decimal string").optional(),
    carbonEstimated:         z.string().regex(/^\d+(\.\d{1,2})?$/, "Must be a decimal string").optional(),
    methodology:             z.string().optional(),
    paymentTerms:            z.any().optional(),
    hasDataSharingAgreement: z.boolean().default(false),
  }),
});

export const UpdateContractSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: CreateContractSchema.shape.body.partial(),
});

// ─── Payout ──────────────────────────────────────────────────────────────────

export const CreatePayoutSchema = z.object({
  body: z.object({
    paymentRef:     z.string().min(1),
    projectOwnerId: z.string().uuid(),
    projectId:      z.string().uuid(),
    transactionId:  z.string().uuid(),
    payoutAmount:   z.string().regex(/^\d+(\.\d{1,2})?$/, "Must be a decimal string"),
    currencyId:     z.number().int().positive(),
    payoutDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
    payoutMethod:   PayoutMethodSchema,
    payoutStatus:   PayoutStatusSchema.default('pending'),
    notes:          z.string().optional(),
  }),
});

export const UpdatePayoutSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: CreatePayoutSchema.shape.body.partial(),
});

// ─── Financial Record ────────────────────────────────────────────────────────

export const CreateFinancialRecordSchema = z.object({
  body: z.object({
    transactionId: z.string().uuid(),
    recordType:    RecordTypeSchema,
    amount:        z.string().regex(/^\d+(\.\d{1,2})?$/, "Must be a decimal string"),
    currencyId:    z.number().int().positive(),
    date:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
    notes:         z.string().optional(),
  }),
});

// ─── Queries ─────────────────────────────────────────────────────────────────

export const ListFinancialsQuerySchema = z.object({
  query: z.object({
    limit:  z.string().transform(Number).default(20),
    cursor: z.string().optional(),
    status: z.string().optional(),
    type:   z.string().optional(),
  }),
});

// ─── Inferred Types ───────────────────────────────────────────────────────────

/**
 * @swagger
 * components:
 *   schemas:
 *     Contract:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         partnerId:
 *           type: integer
 *         projectId:
 *           type: string
 *           format: uuid
 *         farmerId:
 *           type: string
 *           format: uuid
 *         plotId:
 *           type: string
 *           format: uuid
 *         contractRef:
 *           type: string
 *         contractType:
 *           type: string
 *           enum: [project_of_ftake, farmer_of_ftake, spot_purchase, credit_forward, escrow_agreement, interim_agreement]
 *         contractTerms:
 *           type: string
 *         startDate:
 *           type: string
 *           format: date
 *         endDate:
 *           type: string
 *           format: date
 *         status:
 *           type: string
 *           enum: [draft, active, inactive, completed, terminated, on_hold]
 *         committedCredits:
 *           type: string
 *         carbonEstimated:
 *           type: string
 *         methodology:
 *           type: string
 *         hasDataSharingAgreement:
 *           type: boolean
 *     Payout:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         paymentRef:
 *           type: string
 *         projectOwnerId:
 *           type: string
 *           format: uuid
 *         projectId:
 *           type: string
 *           format: uuid
 *         transactionId:
 *           type: string
 *           format: uuid
 *         payoutAmount:
 *           type: string
 *         currencyId:
 *           type: integer
 *         payoutDate:
 *           type: string
 *           format: date
 *         payoutMethod:
 *           type: string
 *           enum: [mobile_money, bank_transfer, cash]
 *         payoutStatus:
 *           type: string
 *           enum: [pending, completed, failed]
 *     FinancialRecord:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         transactionId:
 *           type: string
 *           format: uuid
 *         recordType:
 *           type: string
 *           enum: [platform_fee, refund, contract_payment, commission, correction]
 *         amount:
 *           type: string
 *         currencyId:
 *           type: integer
 *         date:
 *           type: string
 *           format: date
 *         notes:
 *           type: string
 */

export type TCreateContract        = z.infer<typeof CreateContractSchema>;
export type TUpdateContract        = z.infer<typeof UpdateContractSchema>;
export type TCreatePayout          = z.infer<typeof CreatePayoutSchema>;
export type TUpdatePayout          = z.infer<typeof UpdatePayoutSchema>;
export type TCreateFinancialRecord = z.infer<typeof CreateFinancialRecordSchema>;
export type TListFinancialsQuery   = z.infer<typeof ListFinancialsQuerySchema>["query"];
