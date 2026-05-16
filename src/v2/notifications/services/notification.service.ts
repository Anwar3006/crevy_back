import { db } from "@/config/db";
import { notification, userNotification } from "../models/notification.model";
import { eq, and } from "drizzle-orm";
import { user } from "@/v2/auth/models/auth.model";

export interface CreateNotificationParams {
  title: string;
  content: string;
  type: string;
  priority?: "low" | "medium" | "high";
  metadata?: any;
  actionUrl?: string;
  userIds: string[];
}

const NotificationService = {
  /**
   * Creates a notification record and fans it out to multiple users.
   */
  create: async (params: CreateNotificationParams) => {
    const { title, content, type, priority, metadata, actionUrl, userIds } = params;

    return await db.transaction(async (tx) => {
      // 1. Create the base notification
      const [newNotification] = await tx
        .insert(notification)
        .values({
          title,
          content,
          type,
          priority: priority ?? "medium",
          metadata: metadata ?? null,
          actionUrl: actionUrl ?? null,
        })
        .returning();

      // 2. Create per-user notification entries
      const userNotifications = userIds.map((userId) => ({
        notificationId: newNotification.id,
        userId,
      }));

      if (userNotifications.length > 0) {
        await tx.insert(userNotification).values(userNotifications);
      }

      return newNotification;
    });
  },

  /**
   * Mark a notification as read for a specific user.
   */
  markAsRead: async (userId: string, notificationId: string) => {
    return await db
      .update(userNotification)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(
        and(
          eq(userNotification.userId, userId),
          eq(userNotification.notificationId, notificationId)
        )
      );
  },

  /**
   * Get notifications for a specific user.
   */
  getByUser: async (userId: string, limit = 20, offset = 0) => {
    return await db
      .select({
        id: notification.id,
        title: notification.title,
        content: notification.content,
        type: notification.type,
        priority: notification.priority,
        metadata: notification.metadata,
        actionUrl: notification.actionUrl,
        createdAt: notification.createdAt,
        isRead: userNotification.isRead,
        readAt: userNotification.readAt,
      })
      .from(userNotification)
      .innerJoin(notification, eq(userNotification.notificationId, notification.id))
      .where(eq(userNotification.userId, userId))
      .orderBy(notification.createdAt)
      .limit(limit)
      .offset(offset);
  },

  /**
   * Internal bridge for Postgres HTTP client triggers.
   * This receives a table and ID, and decides who to notify.
   */
  handleInternalNotify: async (tableName: string, recordId: string, eventType: string) => {
    // This is where the logic lives to determine who gets notified based on the DB event.
    // For MRV, we might notify the assigned field agent of the plot.
    
    // Example for MRV Ingestion:
    if (tableName === 'mrv_ingestion_event') {
      // 1. Fetch the ingestion and its associated plot/owner/agent
      // (Implementation detail: we'd do a complex join here to find the recipient)
      console.log(`[NotificationBridge] Handling ${eventType} for ${tableName}:${recordId}`);
    }
  }
};

export default NotificationService;
