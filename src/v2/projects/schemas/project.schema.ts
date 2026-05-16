// src/v2/projects/schemas/project.schema.ts
import { z } from 'zod';
import { projectTypeEnum, projectStageEnum, projectStatusEnum, sectorEnum } from '../models/project.model';

export const ProjectTypeSchema = z.enum(projectTypeEnum.enumValues);
export const ProjectStageSchema = z.enum(projectStageEnum.enumValues);
export const ProjectStatusSchema = z.enum(projectStatusEnum.enumValues);
export const SectorSchema = z.enum(sectorEnum.enumValues);

export const CreateProjectSchema = z.object({
  body: z.object({
    name:          z.string().min(1, 'Project name is required'),
    projectType:   ProjectTypeSchema,
    sector:        SectorSchema.default('green_economy'),
    projectTags:   z.array(z.string()).optional(),
    region:        z.string().min(1, 'Region is required'),
    country:       z.string().length(2, 'Country must be a 2-letter code (e.g. GH)'),
    startDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
    endDate:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
    currencyId:    z.number().int().positive(),
  }),
});

export const UpdateProjectSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid project ID'),
  }),
  body: z.object({
    name:          z.string().min(1).optional(),
    projectType:   ProjectTypeSchema.optional(),
    sector:        SectorSchema.optional(),
    projectTags:   z.array(z.string()).optional(),
    projectStage:  ProjectStageSchema.optional(),
    projectStatus: ProjectStatusSchema.optional(),
    region:        z.string().min(1).optional(),
    country:       z.string().length(2).optional(),
    startDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    currencyId:    z.number().int().positive().optional(),
  }),
});

export const ListProjectsQuerySchema = z.object({
  cursor:        z.string().uuid().optional(),
  limit:         z.coerce.number().int().positive().default(10),
  name:          z.string().optional(),
  projectType:   ProjectTypeSchema.optional(),
  projectStage:  ProjectStageSchema.optional(),
  projectStatus: ProjectStatusSchema.optional(),
  region:        z.string().optional(),
  country:       z.string().optional(),
});

/**
 * @swagger
 * components:
 *   schemas:
 *     Project:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         code:
 *           type: string
 *         name:
 *           type: string
 *         projectType:
 *           type: string
 *           enum: [regenerative_agriculture, renewable_energy, waste_management, water_projects, blue_carbon]
 *         sector:
 *           type: string
 *           enum: [green_economy, brown_economy, blue_economy]
 *         projectTags:
 *           type: array
 *           items:
 *             type: string
 *         projectStage:
 *           type: string
 *           enum: [scoping, identification, design, implementation, active, closed]
 *         projectStatus:
 *           type: string
 *           enum: [draft, active, inactive, completed, terminated]
 *         region:
 *           type: string
 *         country:
 *           type: string
 *         startDate:
 *           type: string
 *           format: date
 *         endDate:
 *           type: string
 *           format: date
 *         currencyId:
 *           type: integer
 *         createdBy:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     CreateProject:
 *       type: object
 *       required: [name, projectType, region, country, startDate, currencyId]
 *       properties:
 *         name:
 *           type: string
 *         projectType:
 *           type: string
 *           enum: [regenerative_agriculture, renewable_energy, waste_management, water_projects, blue_carbon]
 *         sector:
 *           type: string
 *           default: green_economy
 *         projectTags:
 *           type: array
 *           items:
 *             type: string
 *         region:
 *           type: string
 *         country:
 *           type: string
 *         startDate:
 *           type: string
 *           format: date
 *         endDate:
 *           type: string
 *           format: date
 *         currencyId:
 *           type: integer
 */

export type TCreateProject      = z.infer<typeof CreateProjectSchema>;
export type TUpdateProject      = z.infer<typeof UpdateProjectSchema>;
export type TListProjectsQuery = z.infer<typeof ListProjectsQuerySchema>;
