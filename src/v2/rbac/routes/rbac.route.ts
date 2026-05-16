// src/v2/rbac/routes/rbac.route.ts
import { Router } from "express";
import RBACController from "../controller/rbac.controller";
import { requireAuth, requirePermission } from "@/middleware/auth.middleware";
import validateInboundRequest from "@/middleware/validateInboundRequest.middleware";
import {
  createRoleSchema,
  createPermissionSchema,
  assignPermissionToRoleSchema,
  unassignPermissionFromRoleSchema,
} from "../schema/rbac.schema";

const rbacRouter = Router();

// Route order: requireAuth → requirePermission → validateInboundRequest → controller
// Auth and permission checks happen before we bother parsing the body —
// no point validating a request we are about to reject anyway.

/**
 * @swagger
 * /rbac/roles:
 *   post:
 *     summary: Create a new role
 *     tags: [RBAC]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Role created successfully
 *
 * /rbac/permissions:
 *   post:
 *     summary: Create a new permission
 *     tags: [RBAC]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [resource, action]
 *             properties:
 *               resource:
 *                 type: string
 *               action:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Permission created successfully
 *
 * /rbac/roles/{roleId}/permissions:
 *   post:
 *     summary: Assign a permission to a role
 *     tags: [RBAC]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [permissionId]
 *             properties:
 *               permissionId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Permission assigned successfully
 *
 * /rbac/roles/{roleId}/permissions/{permissionId}:
 *   delete:
 *     summary: Unassign a permission from a role
 *     tags: [RBAC]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: permissionId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       204:
 *         description: Permission unassigned successfully
 */
rbacRouter.post(
  "/roles",
  requireAuth,
  requirePermission("rbac", "manage"),
  validateInboundRequest(createRoleSchema),
  RBACController.createRole
);

rbacRouter.post(
  "/permissions",
  requireAuth,
  requirePermission("rbac", "manage"),
  validateInboundRequest(createPermissionSchema),
  RBACController.createPermission
);

rbacRouter.post(
  "/roles/:roleId/permissions",
  requireAuth,
  requirePermission("rbac", "manage"),
  validateInboundRequest(assignPermissionToRoleSchema),
  RBACController.assignPermissionToRole
);

rbacRouter.delete(
  "/roles/:roleId/permissions/:permissionId",
  requireAuth,
  requirePermission("rbac", "manage"),
  validateInboundRequest(unassignPermissionFromRoleSchema),
  RBACController.unassignPermissionFromRole
);

export default rbacRouter;
