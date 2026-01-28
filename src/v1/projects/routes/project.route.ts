import { Router } from "express";
import ProjectController from "../controllers/project.controller";
import { requireAuth } from "@/middleware/auth.middleware";
import validateInboundRequest from "@/middleware/validateInboundRequest.middleware";
import {
  createProjectSchema,
  updateProjectSchema,
  projectParamsSchema,
  getAllProjectsSchema,
} from "../schema/projectSchema.schema";

/**
 * Project Routes
 * All routes require authentication via requireAuth middleware
 */
const projectRouter = Router();

/**
 * POST /api/v1/projects
 * Create a new project
 *
 * Authentication: Required
 * Validation: createProjectSchema (validates body)
 */
projectRouter.post(
  "/",
  requireAuth,
  validateInboundRequest(createProjectSchema),
  ProjectController.createProject,
);

/**
 * GET /api/v1/projects
 * Get all projects for authenticated user
 *
 * Authentication: Required
 * Validation: getAllProjectsSchema (validates query params)
 * Query params: page, limit, status, projectType
 */
projectRouter.get(
  "/",
  requireAuth,
  validateInboundRequest(getAllProjectsSchema),
  ProjectController.getAllUserProjects,
);

/**
 * GET /api/v1/projects/:id
 * Get a single project by ID
 *
 * Authentication: Required
 * Validation: projectParamsSchema (validates params)
 */
projectRouter.get(
  "/:id",
  requireAuth,
  validateInboundRequest(projectParamsSchema),
  ProjectController.getSingleUserProject,
);

/**
 * PUT /api/v1/projects/:id
 * Update a project
 *
 * Authentication: Required
 * Validation: updateProjectSchema (validates params and body)
 */
projectRouter.put(
  "/:id",
  requireAuth,
  validateInboundRequest(updateProjectSchema),
  ProjectController.updateProject,
);

/**
 * DELETE /api/v1/projects/:id
 * Delete a project
 *
 * Authentication: Required
 * Validation: projectParamsSchema (validates params)
 */
projectRouter.delete(
  "/:id",
  requireAuth,
  validateInboundRequest(projectParamsSchema),
  ProjectController.deleteProject,
);

export default projectRouter;
