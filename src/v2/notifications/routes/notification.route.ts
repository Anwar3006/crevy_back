import { Router } from "express";
import { requireAuth } from "@/middleware/auth.middleware";
import NotificationController from "../controllers/notification.controller";

const notificationRouter = Router();

/**
 * ─── User Routes ──────────────────────────────────────────────────────────────
 */
/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Get notifications for the authenticated user
 *     tags: [Notifications]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: A list of notifications
 *
 * /notifications/{notificationId}/read:
 *   patch:
 *     summary: Mark a notification as read
 *     tags: [Notifications]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Notification marked as read
 */
notificationRouter.get("/", requireAuth, NotificationController.getMyNotifications);
notificationRouter.patch("/:notificationId/read", requireAuth, NotificationController.markAsRead);

/**
 * ─── Internal Bridge ──────────────────────────────────────────────────────────
 * HIT BY: Postgres triggers or pg_net HTTP client.
 * In production, this should be protected by an internal API key or network CIDR.
 */
/**
 * @swagger
 * /notifications/internal/notify:
 *   post:
 *     summary: Internal notification endpoint (Service-to-Service)
 *     tags: [Notifications - Internal]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tableName:
 *                 type: string
 *               recordId:
 *                 type: string
 *               eventType:
 *                 type: string
 *     responses:
 *       200:
 *         description: Internal notification processed
 */
notificationRouter.post("/internal/notify", NotificationController.handleInternalNotify);

export default notificationRouter;
