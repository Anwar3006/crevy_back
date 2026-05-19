// src/v2/projects/schemas/project.schema.ts
import { z } from 'zod';
import { projectTypeEnum, projectStageEnum, projectStatusEnum, sectorEnum } from '../models/project.model';

export const ProjectTypeSchema   = z.enum(projectTypeEnum.enumValues);
export const ProjectStageSchema  = z.enum(projectStageEnum.enumValues);
export const ProjectStatusSchema = z.enum(projectStatusEnum.enumValues);
export const SectorSchema        = z.enum(sectorEnum.enumValues);

export const CreateProjectSchema = z.object({
  body: z.object({
    name:        z.string().min(1, 'Project name is required').max(255),
    projectType: ProjectTypeSchema,
    sector:      SectorSchema.default('green_economy'),

    // Country accepts ISO alpha-2 (GH) or alpha-3 (GHA) — the CountryDropdown
    // component stores alpha-3 codes. The backend stores whatever is sent.
    country:        z.string().min(2, 'Country is required').max(3),
    region:         z.string().min(1, 'Region is required'),
    gpsCoordinates: z.string().optional().or(z.literal('')),

    totalAreaHectares: z.coerce.number().positive('Area must be greater than 0'),

    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
    endDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),

    projectTags: z.array(z.string()).default([]),
    description: z.string().min(20, 'Project description is required').max(1000),
    sdgs:        z.array(z.string()).default([]),

    currencyId: z.number().int().positive('Select a currency'),
  }),
});

export const UpdateProjectSchema = z.object({
  params: z.object({
    id: z.string('Invalid project ID'),
  }),
  body: z.object({
    name:              z.string().min(1).max(255).optional(),
    projectType:       ProjectTypeSchema.optional(),
    sector:            SectorSchema.optional(),
    projectTags:       z.array(z.string()).optional(),
    description:       z.string().min(1).max(1000).optional(),
    sdgs:              z.array(z.string()).optional(),
    projectStage:      ProjectStageSchema.optional(),
    projectStatus:     ProjectStatusSchema.optional(),
    region:            z.string().min(1).optional(),
    country:           z.string().min(2).max(3).optional(),
    gpsCoordinates:    z.string().optional(),
    totalAreaHectares: z.coerce.number().positive().optional(),
    startDate:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    currencyId:        z.number().int().positive().optional(),
  }),
});

// IMPORTANT: wrapped in `query:` so validateInboundRequest can find it in req.query
export const ListProjectsQuerySchema = z.object({
  query: z.object({
    cursor:        z.string().uuid().optional(),
    limit:         z.coerce.number().int().positive().default(10),
    name:          z.string().optional(),
    projectType:   ProjectTypeSchema.optional(),
    projectStage:  ProjectStageSchema.optional(),
    projectStatus: ProjectStatusSchema.optional(),
    region:        z.string().optional(),
    country:       z.string().optional(),
    createdBy:     z.string().optional(),
  }),
});

export type TCreateProject     = z.infer<typeof CreateProjectSchema>;
export type TUpdateProject     = z.infer<typeof UpdateProjectSchema>;
export type TListProjectsQuery = z.infer<typeof ListProjectsQuerySchema>['query'];
