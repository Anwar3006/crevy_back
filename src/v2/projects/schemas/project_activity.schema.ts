// src/v2/projects/schemas/project_activity.schema.ts
import { z } from 'zod';
import { projectActivityStatusEnum } from '../models/project_activity.model';

export const ProjectActivityStatusSchema = z.enum(
  projectActivityStatusEnum.enumValues
);

export const CreateProjectActivitySchema = z.object({
  body: z.object({
    projectId:           z.string().uuid('Invalid project ID'),
    name:                z.string().min(1, 'Activity name is required'),
    activityDate:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
    activityDescription: z.string().optional(),
    activityStatus:      ProjectActivityStatusSchema.default('planned'),
  }),
});

export const UpdateProjectActivitySchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive('Invalid activity ID'),
  }),
  body: z.object({
    name:                z.string().min(1).optional(),
    activityDate:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    activityDescription: z.string().optional(),
    activityStatus:      ProjectActivityStatusSchema.optional(),
  }),
});

export const ListProjectActivitiesQuerySchema = z.object({
  cursor:         z.coerce.number().int().nonnegative().optional(),
  limit:          z.coerce.number().int().positive().default(10),
  projectId:      z.string().uuid().optional(),
  activityStatus: ProjectActivityStatusSchema.optional(),
});

export type TCreateProjectActivity  = z.infer<typeof CreateProjectActivitySchema>;
export type TUpdateProjectActivity  = z.infer<typeof UpdateProjectActivitySchema>;
export type TListProjectActivitiesQuery = z.infer<typeof ListProjectActivitiesQuerySchema>;
