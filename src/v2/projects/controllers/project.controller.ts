// src/v2/projects/controllers/project.controller.ts
import { catchAsync } from '@/shared/errors/errorHandler';
import { Request, Response } from 'express';
import ProjectService from '../services/project.service';

/**
 * Permission model for projects:
 *
 *   Any authenticated user can CREATE a project — they become the owner.
 *   Viewing your own projects is unrestricted (filtered by createdBy).
 *   Updating/deleting: allowed if createdBy matches the calling user,
 *   or if the user has projects:manage (admin).
 *
 * The old code gated createProject on `project_owners:manage` which meant
 * only admins could create projects. That is wrong for a marketplace platform.
 */
const ProjectController = {

  createProject: catchAsync(async (req: Request, res: Response) => {
    const result = await ProjectService.createProject({
      body:      req.body,
      createdBy: req.user!.id,
    });

    return res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data:    result,
    });
  }),

  updateProject: catchAsync(async (req: Request, res: Response) => {
    // Fetch the project first to check ownership
    const existing = await ProjectService.getProjectById(req.params.id as string);

    if (existing.createdBy !== req.user!.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own projects',
      });
    }

    const result = await ProjectService.updateProject({
      params: { id: req.params.id as string},
      body:   req.body,
    });

    return res.status(200).json({
      success: true,
      message: 'Project updated successfully',
      data:    result,
    });
  }),

  getProjectById: catchAsync(async (req: Request, res: Response) => {
    const result = await ProjectService.getProjectById(req.params.id as string);

    return res.status(200).json({
      success: true,
      data:    result,
    });
  }),

  listProjects: catchAsync(async (req: Request, res: Response) => {
    const result = await ProjectService.listProjects(req.query as any);

    return res.status(200).json({
      success:    true,
      data:       result.data,
      nextCursor: result.nextCursor,
    });
  }),

  deleteProject: catchAsync(async (req: Request, res: Response) => {
    const existing = await ProjectService.getProjectById(req.params.id as string);

    if (existing.createdBy !== req.user!.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own projects',
      });
    }

    await ProjectService.deleteProject(req.params.id as string);
    return res.status(204).send();
  }),
};

export default ProjectController;
