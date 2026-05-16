import { pgTable, pgEnum, uuid, decimal, date, text, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { project } from './project.model'
import { farmPlot } from '@/v2/parent-model'
import { uuidv7PK } from '@/shared/utils/id'


export const projectPlotStatusEnum = pgEnum('project_plot_status_enum', ['enrolled', 'suspended', 'removed'])

/**
 * project_plot
 * Records which specific farm plots are enrolled in a project.
 * Fills the normalisation gap between project and farm_plot:
 *   project_farmer → which farmers?
 *   project_plot   → which specific land parcels?
 * enrolled_area_hectares may be < farm_plot.area_hectares (farmer enrolls only part of a plot).
 * The carbon calculation uses enrolled_area_hectares — NOT the total registered plot area.
 *
 * CRITICAL CONSTRAINT: idx_project_plot_no_double_enrollment
 * A plot can only be 'enrolled' in ONE project at a time.
 */
export const projectPlot = pgTable('project_plot', {
  id:                    uuid('id').primaryKey().$defaultFn(uuidv7PK),
  projectId:             uuid('project_id').notNull().references(() => project.id,   { onDelete: 'cascade' }),
  plotId:                uuid('plot_id').notNull().references(() => farmPlot.id, { onDelete: 'restrict' }),
  enrolledAreaHectares:  decimal('enrolled_area_hectares', { precision: 10, scale: 2 }).notNull(),
  status:                projectPlotStatusEnum('status').notNull().default('enrolled'),
  enrolledDate:          date('enrolled_date').notNull(),
  removedDate:           date('removed_date'),
  notes:                 text('notes'),
  createdAt:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:             timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
})

export const projectPlotRelations = relations(projectPlot, ({ one }) => ({
  project:  one(project,  { fields: [projectPlot.projectId], references: [project.id] }),
  farmPlot: one(farmPlot, { fields: [projectPlot.plotId],    references: [farmPlot.id] }),
}))