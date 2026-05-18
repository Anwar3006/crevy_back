// src/v2/projects/models/project.model.ts
import { pgTable, pgEnum, uuid, varchar, text, date, integer, timestamp, index, jsonb, decimal } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { currency } from '@/v2/parent-model'
import { uuidv7PK } from '@/shared/utils/id'
import { projectOwnerEnrollment } from './project-owner_enrollment.model'

export const projectTypeEnum = pgEnum('project_type_enum', [
  'regenerative_agriculture', // Green Economy — PILOT
  'renewable_energy',          // Green Economy — PILOT
  'waste_management',          // Brown Economy — scaffolded
  'water_projects',            // Blue Economy — scaffolded
  'blue_carbon',               // Blue Economy — scaffolded
])

export const projectStageEnum  = pgEnum('project_stage_enum',  ['registration', 'active', 'verification', 'completed'])
export const projectStatusEnum = pgEnum('project_status_enum', ['draft', 'active', 'suspended', 'closed'])

export const sectorEnum = pgEnum('sector_enum', [
  'green_economy',  // Regen Agri + Renewable Energy — PILOT
  'brown_economy',  // Waste Management — scaffolded
  'blue_economy',   // Blue Carbon / Water Projects — scaffolded
])

/**
 * project
 * Core entity. project.code maps to CraftedClimate's CC-PROJECT-ID namespace —
 * this is the join key between Crevy's DB and the dMRV webhook payloads.
 *
 * Carbon estimation fields (estimatedTotalTco2e, verifiedTotalTco2e) are NOT stored
 * here. Verified credits are derived by querying SUM(mrv_verification_result.net_credits_issued)
 * for this project. CraftedClimate owns the calculation — Crevy does not.
 *
 * projectTags: JSON array of practice/context strings for marketplace display
 * and CraftedClimate deployment context. e.g. ['agroforestry', 'cover_cropping']
 * Replaces the old v1 `regenerativePractices` join table — no impact factors needed.
 */
export const project = pgTable('project', {
  id:                uuid('id').primaryKey().$defaultFn(uuidv7PK),
  code:              varchar('code', { length: 100 }).notNull().unique(),
  name:              varchar('name', { length: 255 }),
  projectType:       projectTypeEnum('project_type').notNull(),
  projectStage:      projectStageEnum('project_stage').notNull().default('registration'),
  projectStatus:     projectStatusEnum('project_status').notNull().default('draft'),
  sector:            sectorEnum('sector').notNull().default('green_economy'),

  // Marketplace & deployment context
  projectTags:       jsonb('project_tags').$type<string[]>().default([]),
  description:       text('description'),
  sdgs:              text('sdgs').array().default([]),

  // Location
  region:            varchar('region', { length: 100 }).notNull(),
  country:           varchar('country', { length: 100 }).notNull(),

  // Timeline
  startDate:         date('start_date').notNull(),
  endDate:           date('end_date'),

  // Financial
  currencyId:        integer('currency_id').notNull().references(() => currency.id, { onDelete: 'restrict' }),

  // Audit
  createdBy:         text('created_by').notNull(),
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:         timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index('idx_project_type').on(t.projectType),
  index('idx_project_status').on(t.projectStatus),
  index('idx_project_code').on(t.code),
  index('idx_project_created_by').on(t.createdBy),
])

export const projectRelations = relations(project, ({ one, many }) => ({
  currency:               one(currency, { fields: [project.currencyId], references: [currency.id] }),
  projectOwnerEnrollments: many(projectOwnerEnrollment),
}))
