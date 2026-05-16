// src/v2/projects/controllers/project_activity.controller.ts
import { catchAsync } from '@/shared/errors/errorHandler';
import { Request, Response } from 'express';
import ProjectActivityService from '../services/project_activity.service';
import RBACService from '@/v2/rbac/service/rbac.service';
import AppError from '@/shared/errors/AppError';

const ProjectActivityController = {

  createActivity: catchAsync(async (req: Request, res: Response) => {
    const hasPermission = await RBACService.hasPermission(
      req.user!.id,
      'project_owners',
      'manage',
    );

    if (!hasPermission) {
      throw new AppError('Only administrators can create activities', 403);
    }

    const result = await ProjectActivityService.createActivity(req.body);

    return res.status(201).json({
      success: true,
      message: 'Activity created successfully',
      data:    result,
    });
  }),

  updateActivity: catchAsync(async (req: Request, res: Response) => {
    const hasPermission = await RBACService.hasPermission(
      req.user!.id,
      'project_owners',
      'manage',
    );

    if (!hasPermission) {
      throw new AppError('Only administrators can update activities', 403);
    }

    const result = await ProjectActivityService.updateActivity({
      params: { id: parseInt(req.params.id) },
      body:   req.body,
    });

    return res.status(200).json({
      success: true,
      message: 'Activity updated successfully',
      data:    result,
    });
  }),

  getActivityById: catchAsync(async (req: Request, res: Response) => {
    const result = await ProjectActivityService.getActivityById(parseInt(req.params.id));

    return res.status(200).json({
      success: true,
      data:    result,
    });
  }),

  listActivities: catchAsync(async (req: Request, res: Response) => {
    const result = await ProjectActivityService.listActivities(req.query as any);

    return res.status(200).json({
      success:    true,
      data:       result.data,
      nextCursor: result.nextCursor,
    });
  }),

  deleteActivity: catchAsync(async (req: Request, res: Response) => {
    const hasPermission = await RBACService.hasPermission(
      req.user!.id,
      'project_owners',
      'manage',
    );

    if (!hasPermission) {
      throw new AppError('Only administrators can delete activities', 403);
    }

    await ProjectActivityService.deleteActivity(parseInt(req.params.id));
    return res.status(204).send();
  }),
};

export default ProjectActivityController;
