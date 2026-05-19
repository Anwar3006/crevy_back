import { z } from "zod";
import { boundaryCollectionMethodEnum } from "../models/farm_plot.model";

export const BoundaryCollectionMethodSchema = z.enum(boundaryCollectionMethodEnum.enumValues);

export const FarmPlotSchema = z.object({
  id: z.string().uuid(),
  projectOwnerId: z.string().uuid(),
  country: z.string().min(1, 'Country is required'),
  region: z.string().min(1, 'Region is required'),
  village: z.string().optional(),
  centroid: z.string().min(1, 'Centroid (WKT) is required'),
  boundary: z.string().optional().nullable(),
  boundaryCollectionMethod: BoundaryCollectionMethodSchema.optional().nullable(),
  areaHectares: z.coerce.number().positive('Area must be positive'),
  boundaryVerified: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CreateFarmPlotSchema = z.object({
  body: z.object({
    projectOwnerId: z.string().uuid(),
    country: z.string().min(1, 'Country is required'),
    region: z.string().min(1, 'Region is required'),
    village: z.string().optional(),
    centroid: z.string().min(1, 'Centroid (WKT) is required'),
    boundary: z.string().optional(),
    boundaryCollectionMethod: BoundaryCollectionMethodSchema.optional(),
    areaHectares: z.coerce.number().positive('Area must be positive'),
  }),
});

export const UpdateFarmPlotSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    country: z.string().optional(),
    region: z.string().optional(),
    village: z.string().optional(),
    centroid: z.string().optional(),
    boundary: z.string().optional(),
    boundaryCollectionMethod: BoundaryCollectionMethodSchema.optional(),
    areaHectares: z.coerce.number().positive().optional(),
    boundaryVerified: z.boolean().optional(),
  }),
});

export const ListFarmPlotsQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().default(10),
  projectOwnerId: z.string().uuid().optional(),
  country: z.string().optional(),
});

export type TFarmPlot = z.infer<typeof FarmPlotSchema>;
export type TCreateFarmPlot = z.infer<typeof CreateFarmPlotSchema>;
export type TUpdateFarmPlot = z.infer<typeof UpdateFarmPlotSchema>;
export type TListFarmPlotsQuery = z.infer<typeof ListFarmPlotsQuerySchema>;
