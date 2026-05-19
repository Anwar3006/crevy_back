// src/v2/project_owners/routes/project_owner.route.ts
import { Router } from "express";
import { requireAuth, requirePermission } from "@/middleware/auth.middleware";
import validateInboundRequest from "@/middleware/validateInboundRequest.middleware";
import {
  CreateProjectOwnerSchema,
  ListProjectOwnersSchema,
  UpdateProjectOwnerSchema,
} from "../schemas/project_owner.schema";
import { projectOwnerOnboardingSchema } from "../schemas/onboarding.schema";
import ProjectOwnerController from "../controllers/project_owner.controller";
import OnboardingController from "../controllers/onboarding.controller";

/**
 * Permission model:
 *   project_owners:manage    → admin: create, view, edit, delete any profile
 *   project_owners:create_self → user: register their own profile only
 *   project_owners:edit_self   → user: update their own profile only
 *
 * OR logic: requirePermission accepts multiple [resource, action] pairs and
 * grants access if the user holds ANY of them. The controller then enforces
 * ownership constraints for non-admin roles.
 */
const projectOwnerRouter = Router();

/**
 * @swagger
 * /project-owners:
 *   post:
 *     summary: Register a project owner profile
 *     tags: [Project Owners]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId]
 *             properties:
 *               userId:
 *                 type: string
 *               bankDetails:
 *                 $ref: '#/components/schemas/ProjectOwner/properties/bankDetails'
 *               momoDetails:
 *                 $ref: '#/components/schemas/ProjectOwner/properties/momoDetails'
 *     responses:
 *       201:
 *         description: Profile created successfully
 *   get:
 *     summary: List project owner profiles
 *     tags: [Project Owners]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: A list of project owners
 *
 * /project-owners/{id}:
 *   get:
 *     summary: Get project owner by ID
 *     tags: [Project Owners]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Profile details
 *   put:
 *     summary: Update project owner profile
 *     tags: [Project Owners]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *   delete:
 *     summary: Delete project owner profile
 *     tags: [Project Owners]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Profile deleted successfully
 */
projectOwnerRouter.post(
  "/onboard",
  requireAuth,
  requirePermission(["project_owner", "manage"]),
  validateInboundRequest(projectOwnerOnboardingSchema),
  OnboardingController.onboardProjectOwner
);

projectOwnerRouter.post(
  "/",
  requireAuth,
  requirePermission(
    ["project_owner", "manage"],
    ["project_owner", "create_self"]
  ),
  validateInboundRequest(CreateProjectOwnerSchema),
  ProjectOwnerController.createProjectOwner
);

projectOwnerRouter.get(
  "/",
  requireAuth,
  requirePermission(["project_owner", "manage"]),
  validateInboundRequest(ListProjectOwnersSchema),       // ← was ListProjectOwnersQuerySchema
  ProjectOwnerController.listProjectOwners
);

projectOwnerRouter.get(
  "/:id",
  requireAuth,
  ProjectOwnerController.getProjectOwner
);

projectOwnerRouter.put(
  "/:id",
  requireAuth,
  requirePermission(
    ["project_owner", "manage"],
    ["project_owner", "edit_self"]
  ),
  validateInboundRequest(UpdateProjectOwnerSchema),
  ProjectOwnerController.updateProjectOwner
);

projectOwnerRouter.delete(
  "/:id",
  requireAuth,
  requirePermission(["project_owner", "manage"]),
  ProjectOwnerController.deleteProjectOwner
);

export default projectOwnerRouter;
