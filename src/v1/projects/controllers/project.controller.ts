import { catchAsync } from "@/shared/errors/errorHandler";
import { TResponsePayload } from "@/shared/types";
import { NextFunction, Request, Response } from "express";
import ProjectServices from "../services/project.service";

const ProjectController = {
  // --- Project Management ---
  /**
   * POST /api/v1/projects
   * Create a new project
   */
  createProject: catchAsync(
    async (
      req: Request,
      res: Response<TResponsePayload<any>>,
      next: NextFunction,
    ) => {
      // User is attached by requireAuth middleware
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
          data: null,
        });
      }

      // Extract validated data from request body
      const projectData = {
        userId: req.user.id,
        ...req.body,
      };

      // Create project via service
      const project = await ProjectServices.createProject(projectData);

      return res.status(201).json({
        success: true,
        message: "Project created successfully",
        data: project,
      });
    },
  ),

  updateProject: catchAsync(
    async (
      req: Request,
      res: Response<TResponsePayload<any>>,
      next: NextFunction,
    ) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
          data: null,
        });
      }

      const { id } = req.params;
      const updateData = req.body;

      // Update project via service
      const project = await ProjectServices.updateProject(
        updateData,
        id as string,
      );

      if (!project) {
        return res.status(404).json({
          success: false,
          message:
            "Project not found or you do not have permission to update it",
          data: null,
        });
      }

      return res.status(200).json({
        success: true,
        message: "Project updated successfully",
        data: project,
      });
    },
  ),

  /**
   * GET /api/v1/projects
   * Get all projects for authenticated user
   */
  getAllUserProjects: catchAsync(
    async (
      req: Request,
      res: Response<TResponsePayload<any>>,
      next: NextFunction,
    ) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
          data: null,
        });
      }

      // Extract query parameters (validated by middleware)
      const query = {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        status: req.query.status as string | undefined,
        projectType: req.query.projectType as string | undefined,
      };

      // Get projects via service
      const projects = await ProjectServices.getAllUserProjects(
        req.user.id,
        query,
      );

      return res.status(200).json({
        success: true,
        message: "Projects retrieved successfully",
        data: projects,
      });
    },
  ),

  /**
   * GET /api/v1/projects/:id
   * Get a single project by ID
   */
  getSingleUserProject: catchAsync(
    async (
      req: Request,
      res: Response<TResponsePayload<any>>,
      next: NextFunction,
    ) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
          data: null,
        });
      }

      const { id } = req.params;

      // Get project via service
      const project = await ProjectServices.getSingleProject(id as string);

      if (!project) {
        return res.status(404).json({
          success: false,
          message:
            "Project not found or you do not have permission to access it",
          data: null,
        });
      }

      return res.status(200).json({
        success: true,
        message: "Project retrieved successfully",
        data: project,
      });
    },
  ),

  /**
   * DELETE /api/v1/projects/:id
   * Delete a project
   */
  deleteProject: async (
    req: Request,
    res: Response<TResponsePayload<any>>,
    next: NextFunction,
  ) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
          data: null,
        });
      }

      const { id } = req.params;

      // Delete project via service
      const result = await ProjectServices.deleteProject(id as string);

      if (!result) {
        return res.status(404).json({
          success: false,
          message:
            "Project not found or you do not have permission to delete it",
          data: null,
        });
      }

      return res.status(200).json({
        success: true,
        message: "Project deleted successfully",
        data: null,
      });
    } catch (error) {
      console.error("Delete project error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to delete project",
        data: null,
      });
    }
  },

  // --- Placeholder for Sequestration & Documents ---

  /**
   * GET /api/v1/projects/marketplace
   * Get projects for the marketplace with filters
   */
  getMarketplaceProjects: catchAsync(
    async (
      req: Request,
      res: Response<TResponsePayload<any>>,
      next: NextFunction,
    ) => {
      const projects = await ProjectServices.getMarketplaceProjects(req.query);

      return res.status(200).json({
        success: true,
        message: "Marketplace projects retrieved successfully",
        data: projects,
      });
    },
  ),

  // Note: These would call ImpactSyncService or DocumentServices
  getRegenerativePractices: catchAsync(
    async (
      req: Request,
      res: Response<TResponsePayload<any>>,
      next: NextFunction,
    ) => {
      const practices = await ProjectServices.getRegenerativePractices();

      return res.status(200).json({
        success: true,
        message: "Regenerative practices retrieved successfully",
        data: practices,
      });
    },
  ),
};

export default ProjectController;
