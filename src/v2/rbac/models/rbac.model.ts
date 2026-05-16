import { pgTable, pgEnum, serial, varchar, text, boolean, timestamp, integer, primaryKey } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ─── ENUMS ────────────────────────────────────────────────────────────────────
export const assignmentTypeEnum = pgEnum('assignment_type_enum', ['primary', 'secondary'])

// ─── TABLES ───────────────────────────────────────────────────────────────────

/**
 * role
 * Named roles on the platform: farmer, company_buyer, admin, verifier, partner_agent.
 * Decoupled from users — add new roles without schema changes to user table.
 */
export const role = pgTable('role', {
  id:          serial('id').primaryKey(),
  name:        varchar('name', { length: 50 }).notNull().unique(),
  description: varchar('description', { length: 255 }),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * permission
 * Defines resource-action pairs: e.g. resource='projects', action='approve'.
 * UNIQUE(resource, action) prevents duplicate permission rows.
 */
export const permission = pgTable('permission', {
  id:          serial('id').primaryKey(),
  resource:    varchar('resource', { length: 100 }).notNull(),
  action:      varchar('action', { length: 100 }).notNull(),
  description: varchar('description', { length: 255 }),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueResourceAction: { columns: [t.resource, t.action] }
}))

/**
 * role_permission
 * Many-to-many bridge between role and permission.
 * Composite PK (role_id, permission_id) prevents duplicates.
 * Changing what a role can do is a DATA change, not a code deployment.
 */
export const rolePermission = pgTable('role_permission', {
  roleId:       integer('role_id').notNull().references(() => role.id, { onDelete: 'cascade' }),
  permissionId: integer('permission_id').notNull().references(() => permission.id, { onDelete: 'cascade' }),
  grantedBy:    text('granted_by'), // FK to user.id — set at app layer
  grantedAt:    timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.roleId, t.permissionId] }),
}))

/**
 * user_role
 * Assigns one or more roles to a user. Supports time-limited assignments (future use).
 * UNIQUE(user_id, role_id) prevents assigning the same role twice.
 * We will not use this table because for now each user will have only one role. 
 * And user table already has a roleId column that serves as a foreign key to the role table.
 */
const userRole = pgTable('user_role', {
  id:         serial('id').primaryKey(),
  userId:     text('user_id').notNull(), // FK to user.id — set at app layer
  roleId:     integer('role_id').notNull().references(() => role.id, { onDelete: 'cascade' }),
  assignedBy: text('assigned_by'),
  assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
  isActive:   boolean('is_active').notNull().default(true),
}, (t) => ({
  uniqueUserRole: { columns: [t.userId, t.roleId] }
}))

// ─── RELATIONS ─────────────────────────────────────────────────────────────
export const roleRelations = relations(role, ({ many }) => ({
  rolePermissions: many(rolePermission),
  // userRoles:       many(userRole), //We will not use this table
}))

export const permissionRelations = relations(permission, ({ many }) => ({
  rolePermissions: many(rolePermission),
}))

export const rolePermissionRelations = relations(rolePermission, ({ one }) => ({
  role:       one(role,       { fields: [rolePermission.roleId],       references: [role.id] }),
  permission: one(permission, { fields: [rolePermission.permissionId], references: [permission.id] }),
}))