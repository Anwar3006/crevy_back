// src/v2/projects/schemas/project_enrollment.schema.ts
import { z } from 'zod';
import { projectParticipationStatusEnum } from '../models/project-owner_enrollment.model';

export const ParticipationStatusSchema = z.enum(
  projectParticipationStatusEnum.enumValues
);

export const EnrollProjectOwnerSchema = z.object({
  body: z.object({
    projectId:      z.string().uuid('Invalid project ID'),
    projectOwnerId: z.string().uuid('Invalid project owner ID'),
    joinedDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  }),
});

export const UpdateEnrollmentSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid enrollment ID'),
  }),
  body: z.object({
    participationStatus: ParticipationStatusSchema,
  }),
});

export const ListEnrollmentsQuerySchema = z.object({
  cursor:              z.string().uuid().optional(),
  limit:               z.coerce.number().int().positive().default(10),
  projectId:           z.string().uuid().optional(),
  projectOwnerId:      z.string().uuid().optional(),
  participationStatus: ParticipationStatusSchema.optional(),
});

export type TEnrollProjectOwner     = z.infer<typeof EnrollProjectOwnerSchema>;
export type TUpdateEnrollment       = z.infer<typeof UpdateEnrollmentSchema>;
export type TListEnrollmentsQuery = z.infer<typeof ListEnrollmentsQuerySchema>;
