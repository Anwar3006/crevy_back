import { z } from 'zod'
import { partnerTypeEnum, partnerStatusEnum } from '../models/partner.model'

// Enum schemas
export const PartnerTypeSchema = z.enum(partnerTypeEnum.enumValues)
export const PartnerStatusSchema = z.enum(partnerStatusEnum.enumValues)

// Partner schema (for reading/displaying existing partners)
export const PartnerSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1, 'Company name is required'),
  partnerType: PartnerTypeSchema,
  contactPerson: z.string().min(1, 'Contact person is required'),
  contactEmail: z.email('Invalid email address'),
  contactPhone: z.string().optional(),
  country: z.string().optional(),
  status: PartnerStatusSchema,
  defaultCurrencyId: z.number().int().positive().nullable(),
  hasDataSharingAgreement: z.boolean(),
  createdAt: z.string().transform((val) => new Date(val)),
})

// Create partner schema (for creating new partners)
export const CreatePartnerSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Company name is required'),
    partnerType: PartnerTypeSchema,
    contactPerson: z.string().min(1, 'Contact person is required'),
    contactEmail: z.email('Invalid email address'),
    contactPhone: z.string().optional(),
    country: z.string().optional(),
    defaultCurrencyId: z.number().int().positive().nullable().optional(),
    hasDataSharingAgreement: z.boolean().default(false),
  }),
})

// Update partner schema
export const UpdatePartnerSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Company name is required').optional(),
    partnerType: PartnerTypeSchema.optional(),
    contactPerson: z.string().min(1, 'Contact person is required').optional(),
    contactEmail: z.string().email('Invalid email address').optional(),
    contactPhone: z.string().optional(),
    country: z.string().optional(),
    status: PartnerStatusSchema.optional(),
    defaultCurrencyId: z.number().int().positive().nullable().optional(),
    hasDataSharingAgreement: z.boolean().optional(),
  }),
    params: z.object({
        id: z.coerce.number().int().positive()
  })
})

// List partners query schema
export const ListPartnersQuerySchema = z.object({
  cursor: z.coerce.number().int().nonnegative().optional(),
  limit: z.coerce.number().int().positive().default(10),
  name: z.string().optional(),
  partnerType: PartnerTypeSchema.optional(),
  country: z.string().optional(),
  status: PartnerStatusSchema.optional(),
})

export type TPartnerType = z.infer<typeof PartnerTypeSchema>
export type TPartnerStatus = z.infer<typeof PartnerStatusSchema>
export type TPartner = z.infer<typeof PartnerSchema>
export type TCreatePartner = z.infer<typeof CreatePartnerSchema>
export type TUpdatePartner = z.infer<typeof UpdatePartnerSchema>
export type TListPartnersQuery = z.infer<typeof ListPartnersQuerySchema>
/**
 * @swagger
 * components:
 *   schemas:
 *     Partner:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         name:
 *           type: string
 *         partnerType:
 *           type: string
 *           enum: [registry, auditing_body, dMRV_provider, technology_provider, aggregator, NGO, financial_institution, channel]
 *         contactPerson:
 *           type: string
 *         contactEmail:
 *           type: string
 *           format: email
 *         contactPhone:
 *           type: string
 *         country:
 *           type: string
 *         status:
 *           type: string
 *           enum: [active, inactive, pending, suspended]
 *         defaultCurrencyId:
 *           type: integer
 *         hasDataSharingAgreement:
 *           type: boolean
 */
