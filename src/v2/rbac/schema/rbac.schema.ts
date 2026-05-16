// src/v2/rbac/schema/rbac.schema.ts
import { z } from "zod";

/**
 * IMPORTANT — schema shape must match what validateInboundRequest wraps:
 *   schema.parse({ body: req.body, query: req.query, params: req.params })
 *
 * So every schema here must have a `body` key (and `params` if the route
 * has URL parameters). Fields that live in the URL go under `params`.
 */

export const createRoleSchema = z.object({
  body: z.object({
    name: z
      .string({ error: "Role name is required" })
      .min(1, "Role name cannot be empty")
      .max(50, "Role name cannot exceed 50 characters"),
    description: z
      .string()
      .max(255, "Description cannot exceed 255 characters")
      .optional(),
  }),
});

export const createPermissionSchema = z.object({
  body: z.object({
    resource: z
      .string({ error: "Resource is required" })
      .min(1, "Resource cannot be empty")
      .max(100, "Resource cannot exceed 100 characters"),
    action: z
      .string({ error: "Action is required" })
      .min(1, "Action cannot be empty")
      .max(100, "Action cannot exceed 100 characters"),
    description: z
      .string()
      .max(255, "Description cannot exceed 255 characters")
      .optional(),
  }),
});

export const assignPermissionToRoleSchema = z.object({
  params: z.object({
    roleId: z
      .string()
      .regex(/^\d+$/, "roleId must be a positive integer"),
  }),
  body: z.object({
    permissionId: z
      .number({ error: "permissionId must be a number" })
      .int("permissionId must be an integer")
      .positive("permissionId must be positive"),
  }),
});

export const unassignPermissionFromRoleSchema = z.object({
  params: z.object({
    roleId: z
      .string()
      .regex(/^\d+$/, "roleId must be a positive integer"),
    permissionId: z
      .string()
      .regex(/^\d+$/, "permissionId must be a positive integer"),
  }),
});
/**
 * @swagger
 * components:
 *   schemas:
 *     Role:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         name:
 *           type: string
 *         description:
 *           type: string
 *     Permission:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         resource:
 *           type: string
 *         action:
 *           type: string
 *         description:
 *           type: string
 */
