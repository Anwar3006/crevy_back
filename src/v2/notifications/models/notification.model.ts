import { pgTable, pgEnum, uuid, varchar, text, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { uuidv7PK } from '@/shared/utils/id'

export const notificationPriorityEnum = pgEnum('notification_priority_enum', ['low', 'medium', 'high'])

/**
 * notification
 * The content record for a notification event. Decoupled from
 * delivery so one event can be sent to multiple users without
 * duplicating the message body.
 */
export const notification = pgTable('notification', {
  id:         uuid('id').primaryKey().$defaultFn(uuidv7PK),
  title:      varchar('title', { length: 255 }).notNull(),
  content:    text('content').notNull(),
  type:       varchar('type', { length: 50 }).notNull(), // e.g. 'mrv', 'project', 'system'
  priority:   notificationPriorityEnum('priority').notNull().default('medium'),
  metadata:   jsonb('metadata'), // stores entity IDs, status codes, etc.
  actionUrl:  text('action_url'), // direct link for the "View" button
  isSystem:   boolean('is_system').notNull().default(true),
  expiresAt:  timestamp('expires_at', { withTimezone: true }), // auto-cleanup or hiding
  createdAt:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * user_notification
 * Tracks per-user delivery and read status for notifications.
 */
export const userNotification = pgTable('user_notification', {
  id:              uuid('id').primaryKey().$defaultFn(uuidv7PK),
  notificationId:  uuid('notification_id').notNull().references(() => notification.id, { onDelete: 'cascade' }),
  userId:          text('user_id').notNull(), // references "user".id
  isRead:          boolean('is_read').notNull().default(false),
  readAt:          timestamp('read_at', { withTimezone: true }),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_user_notification_user_id').on(t.userId),
  index('idx_user_notification_is_read').on(t.isRead),
])

export const notificationRelations = relations(notification, ({ many }) => ({
  userNotifications: many(userNotification),
}))

export const userNotificationRelations = relations(userNotification, ({ one }) => ({
  notification: one(notification, { fields: [userNotification.notificationId], references: [notification.id] }),
}))
