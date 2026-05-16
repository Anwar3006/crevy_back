// src/v2/projects/schemas/project_document.schema.ts
import { z } from 'zod';
import { documentTypeEnum } from '../models/project_docs.model';

export const DocumentTypeSchema = z.enum(documentTypeEnum.enumValues);

export const CreateProjectDocumentSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid project ID'),
  }),
  body: z.object({
    documentType: DocumentTypeSchema,
    fileName:     z.string().min(1, 'File name is required'),
    fileUrl:      z.string().url('Invalid file URL'),
    fileSize:     z.number().int().positive(),
    mimeType:     z.string().optional(),
  }),
});

export const ListProjectDocumentsSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid project ID'),
  }),
});

export const VerifyProjectDocumentSchema = z.object({
  params: z.object({
    id:    z.string().uuid('Invalid project ID'),
    docId: z.string().uuid('Invalid document ID'),
  }),
});

export const DeleteProjectDocumentSchema = z.object({
  params: z.object({
    id:    z.string().uuid('Invalid project ID'),
    docId: z.string().uuid('Invalid document ID'),
  }),
});

/**
 * @swagger
 * components:
 *   schemas:
 *     ProjectDocument:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         projectId:
 *           type: string
 *           format: uuid
 *         documentType:
 *           type: string
 *           enum: [land_ownership, community_consent, site_access_authorization, national_id, site_photos]
 *         fileName:
 *           type: string
 *         fileUrl:
 *           type: string
 *           format: uri
 *         fileSize:
 *           type: integer
 *         mimeType:
 *           type: string
 *         uploadedBy:
 *           type: string
 *         isVerified:
 *           type: boolean
 *         verifiedBy:
 *           type: string
 *         verifiedAt:
 *           type: string
 *           format: date-time
 *         uploadedAt:
 *           type: string
 *           format: date-time
 */

export type TCreateProjectDocument  = z.infer<typeof CreateProjectDocumentSchema>;
export type TVerifyProjectDocument  = z.infer<typeof VerifyProjectDocumentSchema>;
export type TDeleteProjectDocument  = z.infer<typeof DeleteProjectDocumentSchema>;
