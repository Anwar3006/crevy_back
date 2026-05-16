import { Request, Response } from "express";
import { catchAsync } from "@/shared/errors/errorHandler";
import NotificationService from "../services/notification.service";

/**
 * Internal controller for handling events from the database (via pg_net or triggers).
 */
const NotificationController = {
  /**
   * Receives a notification request from an internal source (e.g. DB trigger).
   * Secure this with a shared internal token in production.
   */
  handleInternalNotify: catchAsync(async (req: Request, res: Response) => {
    const { tableName, recordId, eventType } = req.body;
    
    await NotificationService.handleInternalNotify(tableName, recordId, eventType);

    return res.status(200).json({
      success: true,
      message: "Internal notification processed",
    });
  }),

  /**
   * Get notifications for the authenticated user.
   */
  getMyNotifications: catchAsync(async (req: Request, res: Response) => {
    const userId = req.user!.id; // assuming requireAuth sets req.user
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const data = await NotificationService.getByUser(userId, limit, offset);

    return res.status(200).json({
      success: true,
      data,
    });
  }),

  /**
   * Mark a notification as read.
   */
  markAsRead: catchAsync(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { notificationId } = req.params;

    await NotificationService.markAsRead(userId, notificationId as string);

    return res.status(200).json({
      success: true,
      message: "Notification marked as read",
    });
  }),
};

export default NotificationController;
