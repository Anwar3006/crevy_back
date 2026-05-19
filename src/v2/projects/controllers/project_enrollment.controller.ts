// src/v2/projects/controllers/project_enrollment.controller.ts
import { catchAsync } from '@/shared/errors/errorHandler';
import { Request, Response } from 'express';
import ProjectEnrollmentService from '../services/project_enrollment.service';
import RBACService from '@/v2/rbac/service/rbac.service';
import AppError from '@/shared/errors/AppError';

const ProjectEnrollmentController = {

  enrollProjectOwner: catchAsync(async (req: Request, res: Response) => {
    const hasPermission = await RBACService.hasPermission(
      req.user!.id,
      'project_owner',
      'manage',
    );

    if (!hasPermission) {
      throw new AppError('Only administrators can enroll project owners', 403);
    }

    const result = await ProjectEnrollmentService.enrollProjectOwner(req.body);

    return res.status(201).json({
      success: true,
      message: 'Project owner enrolled successfully',
      data:    result,
    });
  }),

  updateEnrollment: catchAsync(async (req: Request, res: Response) => {
    const hasPermission = await RBACService.hasPermission(
      req.user!.id,
      'project_owner',
      'manage',
    );

    if (!hasPermission) {
      throw new AppError('Only administrators can update enrollments', 403);
    }

    const result = await ProjectEnrollmentService.updateEnrollment({
      params: { id: req.params.id as string },
      body:   req.body,
    });

    return res.status(200).json({
      success: true,
      message: 'Enrollment updated successfully',
      data:    result,
    });
  }),

  getEnrollmentById: catchAsync(async (req: Request, res: Response) => {
    const result = await ProjectEnrollmentService.getEnrollmentById(req.params.id as string);

    return res.status(200).json({
      success: true,
      data:    result,
    });
  }),

  listEnrollments: catchAsync(async (req: Request, res: Response) => {
    const result = await ProjectEnrollmentService.listEnrollments(req.query as any);

    return res.status(200).json({
      success:    true,
      data:       result.data,
      nextCursor: result.nextCursor,
    });
  }),

  deleteEnrollment: catchAsync(async (req: Request, res: Response) => {
    const hasPermission = await RBACService.hasPermission(
      req.user!.id,
      'project_owner',
      'manage',
    );

    if (!hasPermission) {
      throw new AppError('Only administrators can delete enrollments', 403);
    }

    await ProjectEnrollmentService.deleteEnrollment(req.params.id as string);
    return res.status(204).send();
  }),
};

export default ProjectEnrollmentController;
