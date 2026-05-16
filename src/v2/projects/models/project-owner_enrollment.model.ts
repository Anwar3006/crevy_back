import { pgTable, pgEnum, uuid, date, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { project } from './project.model'
import { projectOwner } from '@/v2/parent-model'


export const projectParticipationStatusEnum = pgEnum('project_participation_status_enum', ['active', 'suspended', 'withdrawn'])

/**
 * project_owner_enrollment
 * M-to-M join: tracks project owner enrollment in a project.
 * UNIQUE(project_id, project_owner_id) — a project owner can only enroll once per project.
 */
export const projectOwnerEnrollment = pgTable('project_owner_enrollment', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  projectId:            uuid('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
  projectOwnerId:       uuid('project_owner_id').notNull().references(() => projectOwner.id,  { onDelete: 'cascade' }),
  joinedDate:           date('joined_date').notNull(),
  participationStatus:  projectParticipationStatusEnum('participation_status').notNull().default('active'),
  createdAt:            timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:            timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
})

export const projectOwnerEnrollmentRelations = relations(projectOwnerEnrollment, ({ one }) => ({
  project: one(project, { fields: [projectOwnerEnrollment.projectId], references: [project.id] }),
  projectOwner:  one(projectOwner,  { fields: [projectOwnerEnrollment.projectOwnerId],  references: [projectOwner.id] }),
}))