// src/v2/project_owners/schemas/project_owner.schema.ts
import { z } from "zod";

export const ProjectOwnerVerificationStatusSchema = z.enum(['pending', 'verified', 'rejected']);

export const BankDetailsSchema = z.object({
    bankName:      z.string().min(1, 'Bank name is required'),
    accountNumber: z.string().min(1, 'Account number is required'),
    accountName:   z.string().min(1, 'Account name is required'),
});

export const MomoDetailsSchema = z.object({
    network:     z.string().min(1, 'Network name is required'),
    number:      z.string().min(1, 'Mobile money number is required'),
    accountName: z.string().min(1, 'Account name is required'),
});

export const ProjectOwnerSchema = z.object({
    id:                 z.string(),
    userId:             z.string(),
    code:               z.string(),
    verificationStatus: ProjectOwnerVerificationStatusSchema,
    onboardedBy:        z.string(),
    onboardedAt:        z.string(),
    bankDetails:        BankDetailsSchema.nullable(),
    momoDetails:        MomoDetailsSchema.nullable(),
    createdAt:          z.string(),
    updatedAt:          z.string(),
});

// ─── Create ───────────────────────────────────────────────────────────────────

export const CreateProjectOwnerSchema = z.object({
    body: z.object({
        userId:      z.string().min(1, 'userId is required'),
        bankDetails: BankDetailsSchema.optional(),
        momoDetails: MomoDetailsSchema.optional(),
    }),
});

// ─── Update ───────────────────────────────────────────────────────────────────

export const GetProjectOwnerParamsSchema = z.object({
    id: z.string().min(1), // userId — opaque string, no UUID constraint needed
});

export const UpdateProjectOwnerSchema = z.object({
    params: GetProjectOwnerParamsSchema,
    body: z.object({
        bankDetails: BankDetailsSchema.optional(),
        momoDetails: MomoDetailsSchema.optional(),
    }),
});

// ─── List (cursor pagination) ─────────────────────────────────────────────────
//
// IMPORTANT: Must be wrapped in `query:` so validateInboundRequest can find the
// params inside req.query. Without it the middleware looks for cursor/limit at
// the top level of { body, query, params } — finds nothing — applies defaults
// and never updates req.query. Result: limit defaults to 10 regardless of what
// the caller sends, and cursor is always undefined → pagination is broken.

export const ListProjectOwnersSchema = z.object({
    query: z.object({
        cursor:             z.string().uuid("cursor must be a valid UUID").optional(),
        limit:              z.coerce.number().int().positive().default(10),
        userId:             z.string().optional(),
        verificationStatus: ProjectOwnerVerificationStatusSchema.optional(),
    }),
});

// ─── Inferred types ───────────────────────────────────────────────────────────

export type TProjectOwner                 = z.infer<typeof ProjectOwnerSchema>;
export type TProjectOwnerVerificationStatus = z.infer<typeof ProjectOwnerVerificationStatusSchema>;
export type TBankDetails                  = z.infer<typeof BankDetailsSchema>;
export type TMomoDetails                  = z.infer<typeof MomoDetailsSchema>;
export type TCreateProjectOwner           = z.infer<typeof CreateProjectOwnerSchema>;
export type TUpdateProjectOwner           = z.infer<typeof UpdateProjectOwnerSchema>;

// The type that the service receives after Zod coercion — limit is a number, not string
export type TListProjectOwnersQuery       = z.infer<typeof ListProjectOwnersSchema>["query"];
/**
 * @swagger
 * components:
 *   schemas:
 *     ProjectOwner:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         userId:
 *           type: string
 *         code:
 *           type: string
 *         verificationStatus:
 *           type: string
 *           enum: [pending, verified, rejected]
 *         onboardedBy:
 *           type: string
 *         onboardedAt:
 *           type: string
 *           format: date-time
 *         bankDetails:
 *           type: object
 *           properties:
 *             bankName:
 *               type: string
 *             accountNumber:
 *               type: string
 *             accountName:
 *               type: string
 *         momoDetails:
 *           type: object
 *           properties:
 *             network:
 *               type: string
 *             number:
 *               type: string
 *             accountName:
 *               type: string
 */
