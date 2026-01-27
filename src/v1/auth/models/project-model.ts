import {
  boolean,
  decimal,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth-model";

export const projectTypeEnum = pgEnum("project_type_enum", [
  "regenerative_agriculture",
  "renewable_energy",
  "waste_management",
  "biochar",
  "other",
]);
export const projectStatusEnum = pgEnum("project_status_enum", [
  "draft",
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "active",
  "completed",
  "cancelled",
]);

export const project = pgTable("project", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => user.id),

  projectType: projectTypeEnum("project_type")
    .notNull()
    .default("regenerative_agriculture"),
  name: varchar("name").notNull(),
  gpsCoordinates: text("gps_coordinates"),
  location: varchar("location").notNull(),
  startDate: timestamp("start_date").notNull(),
  durationMonths: integer("duration_months").notNull(),
  status: projectStatusEnum("status").notNull().default("draft"),

  totalAreaHectares: decimal("total_area_hectares"),
  baselineLandUse: text("baseline_land_use"),

  soilType: varchar("soil_type"),
  initialSoilCarbonContent: decimal("initial_soil_carbon_content"), //Percentage or tC/ha
  expectedBiomassIncrease: text("expected_biomass_increase"),
  cropLivestockTypes: text("crop_livestock_types"),
  usesSyntheticFertilizers: boolean("uses_synthetic_fertilizers").default(
    false,
  ),
  usesSyntheticPesticides: boolean("uses_synthetic_pesticides").default(false),
  organicAmendments: text("organic_amendments"),

  socialEconomicBenefits: text("social_economic_benefits"),
  supportsBiodiversityConservation: boolean(
    "supports_biodiversity_conservation",
  ).default(false),
  supportsWaterManagement: boolean("supports_water_management").default(false),
  planToExpandPractices: varchar("plan_to_expand_practices"),

  description: text("description"),
  implementationPlan: text("implementation_plan"),
  expectedOutcomes: text("expected_outcomes"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  submittedAt: timestamp("submitted_at"),
});

export const regenerativePractices = pgTable("regenerative_practices", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name").notNull().unique(),
  description: text("description"),
  carbonImpactFactor: decimal("carbon_impact_factor"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const projectPractices = pgTable("project_practices", {
  projectId: uuid("project_id").references(() => project.id),
  practiceId: uuid("practice_id").references(() => regenerativePractices.id),
  areaHectare: decimal("area_hectare").notNull(), // Area where this practice is applied
  intensity: varchar("intensity").notNull(), // Intensity of this practice
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const projectDocument = pgTable("project_document", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => project.id),

  documentType: varchar("document_type").notNull(), // 'project_design', 'environmental_assessment', etc.
  fileName: varchar("file_name").notNull(),
  filePath: varchar("file_path").notNull(),
  fileSize: integer("file_size").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  isVerified: boolean("is_verified").default(false).notNull(),
});
