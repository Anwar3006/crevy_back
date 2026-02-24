import {
  boolean,
  decimal,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { user } from "../../auth/models/auth-model";
import { relations } from "drizzle-orm";

export const projectTypeEnum = pgEnum("project_type_enum", [
  "regenerative_agriculture",
  "renewable_energy",
  "waste_management",
  "biochar",
  "reforestation",
  "blue_carbon",
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

export const project = pgTable(
  "project",
  {
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

    totalAreaHectares: decimal("total_area_hectares", {
      precision: 12,
      scale: 4,
    }),
    baselineLandUse: text("baseline_land_use"),
    // Important for tCO2e: We need a baseline to compare against
    baselineEmissionsYearly: decimal("baseline_emissions_yearly", {
      precision: 12,
      scale: 4,
    }),

    estimatedTotalTco2e: decimal("estimated_total_tco2e", {
      precision: 15,
      scale: 4,
    }).default("0"), //the theoretical potential
    verifiedTotalTco2e: decimal("verified_total_tco2e", {
      precision: 15,
      scale: 4,
    }).default("0"), //what the auditor has actually confirmed

    soilType: varchar("soil_type"),
    initialSoilCarbonContent: decimal("initial_soil_carbon_content"), //Percentage or tC/ha
    expectedBiomassIncrease: text("expected_biomass_increase"),
    cropLivestockTypes: text("crop_livestock_types"),
    usesSyntheticFertilizers: boolean("uses_synthetic_fertilizers").default(
      false,
    ),
    usesSyntheticPesticides: boolean("uses_synthetic_pesticides").default(
      false,
    ),
    organicAmendments: text("organic_amendments"),

    socialEconomicBenefits: text("social_economic_benefits"),
    supportsBiodiversityConservation: boolean(
      "supports_biodiversity_conservation",
    ).default(false),
    supportsWaterManagement: boolean("supports_water_management").default(
      false,
    ),
    planToExpandPractices: varchar("plan_to_expand_practices"),

    description: text("description"),
    implementationPlan: text("implementation_plan"),
    expectedOutcomes: text("expected_outcomes"),
    sdgs: text("sdgs"), // Comma-separated or JSON
    region: varchar("region"), // e.g. Africa, Europe, etc.

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    submittedAt: timestamp("submitted_at"),
  },
  (table) => [
    index("user_id_idx").on(table.userId),
    index("status_idx").on(table.status),
  ],
);

export const regenerativePractices = pgTable("regenerative_practices", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name").notNull().unique(),
  description: text("description"),
  // Impact factor per hectare per year
  carbonImpactFactor: decimal("carbon_impact_factor", {
    precision: 10,
    scale: 6,
  }),
  unit: varchar("unit").default("tCO2e/ha/year"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const projectPractices = pgTable(
  "project_practices",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, {
        onDelete: "cascade",
      }),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => regenerativePractices.id, {
        onDelete: "restrict",
      }),
    impactFactorAtSigning: decimal("impact_factor_at_signing", {
      precision: 10,
      scale: 6,
    }),
    areaHectare: decimal("area_hectare", { precision: 12, scale: 4 }).notNull(), // Area where this practice is applied
    intensity: varchar("intensity").notNull(), // Intensity of this practice
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    // Composite primary key for many-to-many
    primaryKey({ columns: [table.projectId, table.practiceId] }),
    index("pp_project_id_idx").on(table.projectId),
  ],
);

export const projectDocument = pgTable(
  "project_document",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").references(() => project.id, {
      onDelete: "cascade",
    }),

    documentType: varchar("document_type").notNull(), // 'project_design', 'environmental_assessment', etc.
    fileName: varchar("file_name").notNull(),
    filePath: varchar("file_path").notNull(),
    fileSize: integer("file_size").notNull(),
    uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
    isVerified: boolean("is_verified").default(false).notNull(),
  },
  (table) => [index("project_doc_idx").on(table.projectId)],
);

export const carbonSequestrationLog = pgTable(
  "carbon_sequestration_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").references(() => project.id, {
      onDelete: "cascade",
    }),

    year: integer("year").notNull(),
    // Measured soil organic carbon (SOC) or biomass
    measuredValue: decimal("measured_value", { precision: 12, scale: 4 }),
    // The calculated tCO2e for this specific period
    calculatedTco2e: decimal("calculated_tco2e", { precision: 12, scale: 4 }),

    verificationStatus: varchar("verification_status").default("pending"), // pending, verified, disputed
    verifiedBy: varchar("verified_by"), // Third-party auditor name

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("project_year_idx").on(table.projectId, table.year)],
);

// Drizzle Relations

// 1. Project Relations
export const projectRelations = relations(project, ({ one, many }) => ({
  user: one(user, {
    fields: [project.userId],
    references: [user.id],
  }),
  projectPractices: many(projectPractices),
  documents: many(projectDocument),
  sequestrationLogs: many(carbonSequestrationLog),
}));

// 2. Regenerative Practices Relations (The Master List)
export const regenerativePracticesRelations = relations(
  regenerativePractices,
  ({ many }) => ({
    projectPractices: many(projectPractices),
  }),
);

// 3. Project Practices Relations (The Join Table)
export const projectPracticesRelations = relations(
  projectPractices,
  ({ one }) => ({
    project: one(project, {
      fields: [projectPractices.projectId],
      references: [project.id],
    }),
    practice: one(regenerativePractices, {
      fields: [projectPractices.practiceId],
      references: [regenerativePractices.id],
    }),
  }),
);

// 4. Project Document Relations
export const projectDocumentRelations = relations(
  projectDocument,
  ({ one }) => ({
    project: one(project, {
      fields: [projectDocument.projectId],
      references: [project.id],
    }),
  }),
);

// 5. Sequestration Log Relations
export const carbonSequestrationLogRelations = relations(
  carbonSequestrationLog,
  ({ one }) => ({
    project: one(project, {
      fields: [carbonSequestrationLog.projectId],
      references: [project.id],
    }),
  }),
);
