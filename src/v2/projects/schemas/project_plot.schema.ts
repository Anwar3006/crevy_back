// src/v2/projects/schemas/project_plot.schema.ts
import { z } from 'zod';
import { projectPlotStatusEnum } from '../models/project-plot.model';

export const ProjectPlotStatusSchema = z.enum(
  projectPlotStatusEnum.enumValues
);

export const EnrollPlotSchema = z.object({
  body: z.object({
    projectId:             z.string().uuid('Invalid project ID'),
    plotId:                z.string().uuid('Invalid plot ID'),
    enrolledAreaHectares:  z.coerce.number().positive('Enrolled area must be positive'),
    enrolledDate:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
    notes:                 z.string().optional(),
  }),
});

export const UpdateProjectPlotSchema = z.object({
  params: z.object({
    id: z.string('Invalid project-plot ID'),
  }),
  body: z.object({
    enrolledAreaHectares: z.coerce.number().positive().optional(),
    status:               ProjectPlotStatusSchema.optional(),
    removedDate:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    notes:                z.string().optional(),
  }),
});

export const ListProjectPlotsQuerySchema = z.object({
  cursor:    z.string().uuid().optional(),
  limit:     z.coerce.number().int().positive().default(10),
  projectId: z.string().uuid().optional(),
  plotId:    z.string().uuid().optional(),
  status:    ProjectPlotStatusSchema.optional(),
});

export type TEnrollPlot            = z.infer<typeof EnrollPlotSchema>;
export type TUpdateProjectPlot      = z.infer<typeof UpdateProjectPlotSchema>;
export type TListProjectPlotsQuery = z.infer<typeof ListProjectPlotsQuerySchema>;
