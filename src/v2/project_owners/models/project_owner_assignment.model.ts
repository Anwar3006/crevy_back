import { pgTable, uuid, text, integer, boolean, timestamp, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { partner } from '../../partners/models/partner.model'
import { assignmentTypeEnum } from '../../rbac/models/rbac.model'
import { projectOwner } from './project_owner.model'
import { uuidv7PK } from '@/shared/utils/id'

/**
 * project_owner_assignment
 * Links a project_owner to a Crevy field agent and optionally to a partner organisation.
 * assignment_type = 'primary' means this agent is the main point of contact.
 * is_b2c_assignment = TRUE: Crevy onboarded directly (partner_id will be NULL).
 * is_b2c_assignment = FALSE: partner-mediated onboarding (partner_id must be set).
 * Only one PRIMARY assignment per project_owner at a time — enforced at the application layer.
 */
export const projectOwnerAssignment = pgTable('project_owner_assignment', {
  id:              uuid('id').primaryKey().$defaultFn(uuidv7PK),
  projectOwnerId:  uuid('project_owner_id').notNull().references(() => projectOwner.id, { onDelete: 'cascade' }),
  agentId:         text('agent_id').notNull(),   // FK → user.id (set at app layer)
  assignedBy:      text('assigned_by').notNull(), // FK → user.id
  partnerId:       integer('partner_id').references(() => partner.id, { onDelete: 'set null' }),
  assignmentType:  assignmentTypeEnum('assignment_type').notNull(),
  isB2cAssignment: boolean('is_b2c_assignment').notNull().default(false),
  isActive:        boolean('is_active').notNull().default(true),
  assignedAt:      timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index('idx_project_owner_assignment_project_owner_id').on(t.projectOwnerId),
  index('idx_project_owner_assignment_agent_id').on(t.agentId),
])

export const projectOwnerAssignmentRelations = relations(projectOwnerAssignment, ({ one }) => ({
  projectOwner:  one(projectOwner,  { fields: [projectOwnerAssignment.projectOwnerId],  references: [projectOwner.id] }),
  partner: one(partner, { fields: [projectOwnerAssignment.partnerId], references: [partner.id] }),
}))
