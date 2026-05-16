// src/v2/projects/controllers/project.controller.ts
import { catchAsync } from '@/shared/errors/errorHandler';
import { Request, Response } from 'express';
import ProjectService from '../services/project.service';
import RBACService from '@/v2/rbac/service/rbac.service';
import AppError from '@/shared/errors/AppError';

const ProjectController = {

  createProject: catchAsync(async (req: Request, res: Response) => {
    // Only admins/managers can create projects
    const hasPermission = await RBACService.hasPermission(
      req.user!.id,
      'project_owners', // Reusing project_owners for now as general project permission
      'manage',
    );

    if (!hasPermission) {
      throw new AppError('Only administrators can create projects', 403);
    }

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
    const hasPermission = await RBACService.hasPermission(
      req.user!.id,
      'project_owners',
      'manage',
    );

    if (!hasPermission) {
      throw new AppError('Only administrators can update projects', 403);
    }

    const result = await ProjectService.updateProject({
      params: { id: req.params.id },
      body:   req.body,
    });

    return res.status(200).json({
      success: true,
      message: 'Project updated successfully',
      data:    result,
    });
  }),

  getProjectById: catchAsync(async (req: Request, res: Response) => {
    const result = await ProjectService.getProjectById(req.params.id);

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
    const hasPermission = await RBACService.hasPermission(
      req.user!.id,
      'project_owners',
      'manage',
    );

    if (!hasPermission) {
      throw new AppError('Only administrators can delete projects', 403);
    }

    await ProjectService.deleteProject(req.params.id);
    return res.status(204).send();
  }),
};

export default ProjectController;
