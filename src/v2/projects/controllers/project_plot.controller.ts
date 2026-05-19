// src/v2/projects/controllers/project_plot.controller.ts
import { catchAsync } from '@/shared/errors/errorHandler';
import { Request, Response } from 'express';
import ProjectPlotService from '../services/project_plot.service';
import RBACService from '@/v2/rbac/service/rbac.service';
import AppError from '@/shared/errors/AppError';

const ProjectPlotController = {

  enrollPlot: catchAsync(async (req: Request, res: Response) => {
    const hasPermission = await RBACService.hasPermission(
      req.user!.id,
      'project_owner',
      'manage',
    );

    if (!hasPermission) {
      throw new AppError('Only administrators can enroll plots', 403);
    }

    const result = await ProjectPlotService.enrollPlot(req.body);

    return res.status(201).json({
      success: true,
      message: 'Plot enrolled in project successfully',
      data:    result,
    });
  }),

  updateProjectPlot: catchAsync(async (req: Request, res: Response) => {
    const hasPermission = await RBACService.hasPermission(
      req.user!.id,
      'project_owner',
      'manage',
    );

    if (!hasPermission) {
      throw new AppError('Only administrators can update project plots', 403);
    }

    const result = await ProjectPlotService.updateProjectPlot({
      params: { id: req.params.id as string },
      body:   req.body,
    });

    return res.status(200).json({
      success: true,
      message: 'Project plot enrollment updated successfully',
      data:    result,
    });
  }),

  getProjectPlotById: catchAsync(async (req: Request, res: Response) => {
    const result = await ProjectPlotService.getProjectPlotById(req.params.id as string);

    return res.status(200).json({
      success: true,
      data:    result,
    });
  }),

  listProjectPlots: catchAsync(async (req: Request, res: Response) => {
    const result = await ProjectPlotService.listProjectPlots(req.query as any);

    return res.status(200).json({
      success:    true,
      data:       result.data,
      nextCursor: result.nextCursor,
    });
  }),

  deleteProjectPlot: catchAsync(async (req: Request, res: Response) => {
    const hasPermission = await RBACService.hasPermission(
      req.user!.id,
      'project_owner',
      'manage',
    );

    if (!hasPermission) {
      throw new AppError('Only administrators can delete project plot enrollments', 403);
    }

    await ProjectPlotService.deleteProjectPlot(req.params.id as string);
    return res.status(204).send();
  }),
};

export default ProjectPlotController;
