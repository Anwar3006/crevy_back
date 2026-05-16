import { pgTable, pgEnum, serial, uuid, varchar, date, text, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { project } from './project.model'

export const projectActivityStatusEnum = pgEnum('project_activity_status_enum', ['planned', 'in_progress', 'completed', 'skipped', 'rejected'])

/**
 * project_activity
 * Time-stamped operational milestones: sensor installation, soil sampling,
 * tree planting, auditor site visit, etc.
 * Feeds the "Track Verification" dashboard feature.
 */
export const projectActivity = pgTable('project_activity', {
  id:                  serial('id').primaryKey(),
  projectId:           uuid('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
  name:                varchar('name', { length: 100 }).notNull(),
  activityDate:        date('activity_date').notNull(),
  activityDescription: text('activity_description'),
  activityStatus:      projectActivityStatusEnum('activity_status').notNull().default('planned'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const projectActivityRelations = relations(projectActivity, ({ one }) => ({
  project: one(project, { fields: [projectActivity.projectId], references: [project.id] }),
}))