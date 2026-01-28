//insert images in richTextEditor, edit it to have standard sizes
//clear all the map pins for the other none-facility
//Google Maps API - handling load during peak times

import { z } from "zod";

// Practice schema for nested validation
const practiceSchema = z.object({
  practiceId: z.string().uuid("Invalid practice ID format"),
  areaHectare: z
    .number()
    .positive("Area must be positive")
    .or(z.string().transform((val) => parseFloat(val))),
  intensity: z.string().min(1, "Intensity is required"),
});

// Schema for creating a new project
export const createProjectSchema = z.object({
  body: z.object({
    // Required fields
    name: z.string().min(1, "Project name is required").max(255),
    location: z.string().min(1, "Location is required").max(255),
    startDate: z.coerce.date({
      error: () => ({ message: "Invalid date format (ISO 8601 required)" }),
    }),
    durationMonths: z
      .number()
      .int()
      .positive("Duration must be a positive integer"),

    // Project type and status
    projectType: z
      .enum([
        "regenerative_agriculture",
        "renewable_energy",
        "waste_management",
        "biochar",
        "other",
      ])
      .default("regenerative_agriculture"),
    status: z
      .enum([
        "draft",
        "submitted",
        "under_review",
        "approved",
        "rejected",
        "active",
        "completed",
        "cancelled",
      ])
      .default("draft"),

    // Optional numeric fields
    totalAreaHectares: z
      .number()
      .positive("Total area must be positive")
      .optional()
      .or(
        z
          .string()
          .transform((val) => parseFloat(val))
          .optional(),
      ),
    baselineEmissionsYearly: z
      .number()
      .nonnegative("Baseline emissions cannot be negative")
      .optional()
      .or(
        z
          .string()
          .transform((val) => parseFloat(val))
          .optional(),
      ),

    // Optional text fields
    gpsCoordinates: z.string().optional(),
    baselineLandUse: z.string().optional(),
    soilType: z.string().max(255).optional(),
    initialSoilCarbonContent: z
      .number()
      .optional()
      .or(
        z
          .string()
          .transform((val) => parseFloat(val))
          .optional(),
      ),
    expectedBiomassIncrease: z.string().optional(),
    cropLivestockTypes: z.string().optional(),
    organicAmendments: z.string().optional(),
    socialEconomicBenefits: z.string().optional(),
    planToExpandPractices: z.string().max(255).optional(),
    description: z.string().optional(),
    implementationPlan: z.string().optional(),
    expectedOutcomes: z.string().optional(),

    // Boolean fields
    usesSyntheticFertilizers: z.boolean().default(false),
    usesSyntheticPesticides: z.boolean().default(false),
    supportsBiodiversityConservation: z.boolean().default(false),
    supportsWaterManagement: z.boolean().default(false),

    // Practices array
    practices: z.array(practiceSchema).optional().default([]),
  }),
});

// Schema for updating an existing project
export const updateProjectSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid project ID format"),
  }),
  body: z.object({
    // All fields optional for updates
    name: z.string().min(1).max(255).optional(),
    location: z.string().min(1).max(255).optional(),
    startDate: z.string().datetime().optional(),
    durationMonths: z.number().int().positive().optional(),

    projectType: z
      .enum([
        "regenerative_agriculture",
        "renewable_energy",
        "waste_management",
        "biochar",
        "other",
      ])
      .optional(),
    status: z
      .enum([
        "draft",
        "submitted",
        "under_review",
        "approved",
        "rejected",
        "active",
        "completed",
        "cancelled",
      ])
      .optional(),

    totalAreaHectares: z
      .number()
      .positive()
      .optional()
      .or(
        z
          .string()
          .transform((val) => parseFloat(val))
          .optional(),
      ),
    baselineEmissionsYearly: z
      .number()
      .nonnegative()
      .optional()
      .or(
        z
          .string()
          .transform((val) => parseFloat(val))
          .optional(),
      ),

    gpsCoordinates: z.string().optional(),
    baselineLandUse: z.string().optional(),
    soilType: z.string().max(255).optional(),
    initialSoilCarbonContent: z
      .number()
      .optional()
      .or(
        z
          .string()
          .transform((val) => parseFloat(val))
          .optional(),
      ),
    expectedBiomassIncrease: z.string().optional(),
    cropLivestockTypes: z.string().optional(),
    organicAmendments: z.string().optional(),
    socialEconomicBenefits: z.string().optional(),
    planToExpandPractices: z.string().max(255).optional(),
    description: z.string().optional(),
    implementationPlan: z.string().optional(),
    expectedOutcomes: z.string().optional(),

    usesSyntheticFertilizers: z.boolean().optional(),
    usesSyntheticPesticides: z.boolean().optional(),
    supportsBiodiversityConservation: z.boolean().optional(),
    supportsWaterManagement: z.boolean().optional(),

    practices: z.array(practiceSchema).optional(),
  }),
});

// Schema for getting a single project or deleting
export const projectParamsSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid project ID format"),
  }),
});

// Schema for getting all projects (query params for pagination, filtering)
export const getAllProjectsSchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val) : 1))
      .refine((val) => val > 0, "Page must be positive"),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val) : 10))
      .refine(
        (val) => val > 0 && val <= 100,
        "Limit must be between 1 and 100",
      ),
    status: z
      .enum([
        "draft",
        "submitted",
        "under_review",
        "approved",
        "rejected",
        "active",
        "completed",
        "cancelled",
      ])
      .optional(),
    projectType: z
      .enum([
        "regenerative_agriculture",
        "renewable_energy",
        "waste_management",
        "biochar",
        "other",
      ])
      .optional(),
  }),
});
