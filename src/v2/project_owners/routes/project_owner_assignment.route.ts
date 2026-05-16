// src/v2/project_owners/routes/project_owner_assignment.route.ts
import { Router } from 'express';
import { requireAuth, requirePermission } from '@/middleware/auth.middleware';
import validateInboundRequest from '@/middleware/validateInboundRequest.middleware';
import {
  CreateProjectOwnerAssignmentSchema,
  ListProjectOwnerAssignmentsQuerySchema,
  UpdateProjectOwnerAssignmentSchema,
} from '../schemas/project_owner_assignment.schema';
import ProjectOwnerAssignmentController from '../controllers/project_owner_assignment.controller';

/**
 * Permission model for project_owner_assignment:
 *
 *   project_owners:manage  → Admin — full CRUD access
 *   project_owners:assign  → Field agent — create & update own assignments
 *
 * POST   /  → manage OR assign
 * GET    /  → manage only (internal listing)
 * GET   /:id → any authenticated user
 * PUT   /:id → manage OR the agentId of the existing record (enforced in controller)
 * DELETE/:id → manage only
 */
const projectOwnerAssignmentRouter = Router();

/**
 * @swagger
 * /project-owner-assignments:
 *   post:
 *     summary: Create a project owner assignment
 *     tags: [Project Owners - Assignments]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       201:
 *         description: Assignment created successfully
 *   get:
 *     summary: List project owner assignments
 *     tags: [Project Owners - Assignments]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: A list of assignments
 */
projectOwnerAssignmentRouter.post(
  '/',
  requireAuth,
  requirePermission(
    ['project_owners', 'manage'],
    ['project_owners', 'assign'],
  ),
  validateInboundRequest(CreateProjectOwnerAssignmentSchema),
  ProjectOwnerAssignmentController.createAssignment,
);

projectOwnerAssignmentRouter.get(
  '/',
  requireAuth,
  requirePermission(['project_owners', 'manage']),
  validateInboundRequest(ListProjectOwnerAssignmentsQuerySchema),
  ProjectOwnerAssignmentController.listAssignments,
);

projectOwnerAssignmentRouter.get(
  '/:id',
  requireAuth,
  ProjectOwnerAssignmentController.getAssignmentById,
);

projectOwnerAssignmentRouter.put(
  '/:id',
  requireAuth,
  requirePermission(
    ['project_owners', 'manage'],
    ['project_owners', 'assign'],
  ),
  validateInboundRequest(UpdateProjectOwnerAssignmentSchema),
  ProjectOwnerAssignmentController.updateAssignment,
);

projectOwnerAssignmentRouter.delete(
  '/:id',
  requireAuth,
  requirePermission(['project_owners', 'manage']),
  ProjectOwnerAssignmentController.deleteAssignment,
);

export default projectOwnerAssignmentRouter;
