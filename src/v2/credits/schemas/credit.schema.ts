import { z } from 'zod';
import { creditStatusEnum } from '../models/carbon_credit.model';
import { transactionStatusEnum } from '../models/credit_transaction.model';
import { verificationStatusEnum } from '../../mrv/models/mrv_verification.model';

const DateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)');
const DecimalInputSchema = z.coerce.number().positive();

export const CreditStatusSchema = z.enum(creditStatusEnum.enumValues);
export const TransactionStatusSchema = z.enum(transactionStatusEnum.enumValues);
export const VerificationStatusSchema = z.enum(verificationStatusEnum.enumValues);

export const CreateCarbonCreditSchema = z.object({
  body: z.object({
    projectId:          z.string().uuid('Invalid project ID'),
    serialNumberStart:  z.string().min(1).max(100),
    serialNumberEnd:    z.string().min(1).max(100),
    totalAmount:        DecimalInputSchema,
    availableAmount:    DecimalInputSchema.optional(),
    creditVintage:      z.coerce.number().int().min(1900).max(3000),
    creditStatus:       CreditStatusSchema.default('available'),
    mrv_batch_id:       z.string().min(1).max(100),
    blockchainTxHash:   z.string().min(1).max(255),
    currentOwnerId:     z.string().min(1),
    registry:           z.string().max(100).optional(),
    generationDate:     DateStringSchema.optional(),
    verificationDate:   DateStringSchema.optional(),
    issuanceDate:       DateStringSchema.optional(),
    transactionId:      z.string().uuid().optional(),
  }).refine(
    (body) => body.availableAmount === undefined || body.availableAmount <= body.totalAmount,
    { path: ['availableAmount'], message: 'availableAmount cannot exceed totalAmount' },
  ),
});

export const ListCarbonCreditsQuerySchema = z.object({
  query: z.object({
    limit:        z.coerce.number().int().positive().max(100).default(20),
    offset:       z.coerce.number().int().nonnegative().default(0),
    projectId:    z.string().uuid().optional(),
    currentOwnerId: z.string().min(1).optional(),
    creditStatus: CreditStatusSchema.optional(),
    creditVintage: z.coerce.number().int().min(1900).max(3000).optional(),
    mrv_batch_id: z.string().min(1).optional(),
  }),
});

export const CreditIdParamsSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid credit ID'),
  }),
});

export const UpdateCarbonCreditStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid credit ID'),
  }),
  body: z.object({
    creditStatus: CreditStatusSchema,
  }),
});

export const PurchaseCarbonCreditSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid credit ID'),
  }),
  body: z.object({
    quantity:       DecimalInputSchema,
    pricePerCredit: DecimalInputSchema,
    currencyId:     z.coerce.number().int().positive(),
    notes:          z.string().optional(),
  }),
});

export const RetireCarbonCreditSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid credit ID'),
  }),
  body: z.object({
    quantity: DecimalInputSchema,
    notes:    z.string().optional(),
  }),
});

export const ListCreditTransactionsQuerySchema = z.object({
  query: z.object({
    limit:             z.coerce.number().int().positive().max(100).default(20),
    offset:            z.coerce.number().int().nonnegative().default(0),
    buyerId:           z.string().min(1).optional(),
    sellerId:          z.string().min(1).optional(),
    transactionStatus: TransactionStatusSchema.optional(),
  }),
});

export const TransactionIdParamsSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid transaction ID'),
  }),
});

export const CreateCreditVerificationSchema = z.object({
  body: z.object({
    projectId:            z.string().uuid('Invalid project ID'),
    verifierPartnerId:    z.coerce.number().int().positive(),
    verificationEventId:  z.string().min(1).max(200),
    methodologyApplied:   z.string().max(100).optional(),
    verificationDate:     DateStringSchema,
    verificationStatus:   VerificationStatusSchema,
    verificationNotes:    z.string().optional(),
  }),
});

export const UpdateCreditVerificationSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid verification ID'),
  }),
  body: z.object({
    methodologyApplied: z.string().max(100).optional(),
    verificationDate:   DateStringSchema.optional(),
    verificationStatus: VerificationStatusSchema.optional(),
    verificationNotes:  z.string().optional(),
  }),
});

export const ListCreditVerificationsQuerySchema = z.object({
  query: z.object({
    limit:              z.coerce.number().int().positive().max(100).default(20),
    offset:             z.coerce.number().int().nonnegative().default(0),
    projectId:          z.string().uuid().optional(),
    verifierPartnerId:  z.coerce.number().int().positive().optional(),
    verificationStatus: VerificationStatusSchema.optional(),
  }),
});

export const VerificationIdParamsSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid verification ID'),
  }),
});

/**
 * @swagger
 * components:
 *   schemas:
 *     CarbonCredit:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         projectId:
 *           type: string
 *           format: uuid
 *         serialNumberStart:
 *           type: string
 *         serialNumberEnd:
 *           type: string
 *         totalAmount:
 *           type: number
 *         availableAmount:
 *           type: number
 *         creditVintage:
 *           type: integer
 *         creditStatus:
 *           type: string
 *           enum: [available, reserved, retired, pending]
 *         mrv_batch_id:
 *           type: string
 *         blockchainTxHash:
 *           type: string
 *         issuanceDate:
 *           type: string
 *           format: date
 *     CreditTransaction:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         creditId:
 *           type: string
 *           format: uuid
 *         buyerId:
 *           type: string
 *         sellerId:
 *           type: string
 *         quantity:
 *           type: number
 *         pricePerCredit:
 *           type: number
 *         totalAmount:
 *           type: number
 *         currencyId:
 *           type: integer
 *         transactionStatus:
 *           type: string
 *           enum: [pending, completed, failed, cancelled]
 */

export type TCreateCarbonCredit = z.infer<typeof CreateCarbonCreditSchema>;
export type TListCarbonCreditsQuery = z.infer<typeof ListCarbonCreditsQuerySchema>['query'];
export type TUpdateCarbonCreditStatus = z.infer<typeof UpdateCarbonCreditStatusSchema>;
export type TPurchaseCarbonCredit = z.infer<typeof PurchaseCarbonCreditSchema>;
export type TRetireCarbonCredit = z.infer<typeof RetireCarbonCreditSchema>;
export type TListCreditTransactionsQuery = z.infer<typeof ListCreditTransactionsQuerySchema>['query'];
export type TCreateCreditVerification = z.infer<typeof CreateCreditVerificationSchema>;
export type TUpdateCreditVerification = z.infer<typeof UpdateCreditVerificationSchema>;
export type TListCreditVerificationsQuery = z.infer<typeof ListCreditVerificationsQuerySchema>['query'];
