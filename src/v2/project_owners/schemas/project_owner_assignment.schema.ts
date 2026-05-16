// src/v2/project_owners/schemas/project_owner_assignment.schema.ts
import { z } from 'zod';
import { assignmentTypeEnum } from '@/v2/rbac/models/rbac.model';

export const AssignmentTypeSchema = z.enum(
  assignmentTypeEnum.enumValues as [string, ...string[]],
);

// ── Create ────────────────────────────────────────────────────────────────────

export const CreateProjectOwnerAssignmentSchema = z.object({
  body: z.object({
    projectOwnerId:  z.string().min(1, 'projectOwnerId is required'),
    agentId:         z.string().min(1, 'agentId is required'),
    partnerId:       z.number().int().positive().optional(),
    assignmentType:  AssignmentTypeSchema,
    isB2cAssignment: z.boolean().default(false),
  }),
});

// ── Update ────────────────────────────────────────────────────────────────────

export const UpdateProjectOwnerAssignmentSchema = z.object({
  params: z.object({
    id: z.string().uuid('id must be a valid UUID'),
  }),
  body: z.object({
    agentId:         z.string().min(1).optional(),
    partnerId:       z.number().int().positive().nullable().optional(),
    assignmentType:  AssignmentTypeSchema.optional(),
    isB2cAssignment: z.boolean().optional(),
    isActive:        z.boolean().optional(),
  }),
});

// ── List / query ──────────────────────────────────────────────────────────────

export const ListProjectOwnerAssignmentsQuerySchema = z.object({
  cursor:          z.string().uuid().optional(),
  limit:           z.coerce.number().int().positive().default(10),
  projectOwnerId:  z.string().uuid().optional(),
  agentId:         z.string().optional(),
  assignmentType:  AssignmentTypeSchema.optional(),
  isActive:        z.coerce.boolean().optional(),
  partnerId:       z.coerce.number().int().positive().optional(),
});

// ── Inferred types ────────────────────────────────────────────────────────────

export type TCreateProjectOwnerAssignment  = z.infer<typeof CreateProjectOwnerAssignmentSchema>;
export type TUpdateProjectOwnerAssignment  = z.infer<typeof UpdateProjectOwnerAssignmentSchema>;
export type TListProjectOwnerAssignmentsQuery = z.infer<typeof ListProjectOwnerAssignmentsQuerySchema>;
