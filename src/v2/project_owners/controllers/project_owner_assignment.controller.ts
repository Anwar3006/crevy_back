// src/v2/project_owners/controllers/project_owner_assignment.controller.ts
import { catchAsync } from '@/shared/errors/errorHandler';
import { Request, Response } from 'express';
import ProjectOwnerAssignmentService from '../services/project_owner_assignment.service';
import RBACService from '@/v2/rbac/service/rbac.service';
import AppError from '@/shared/errors/AppError';

const ProjectOwnerAssignmentController = {

  /**
   * POST /project-owner-assignments
   *
   * Only agents (or admins with project_owners:manage) may create assignments.
   * The `assignedBy` is always the authenticated user.
   */
  createAssignment: catchAsync(async (req: Request, res: Response) => {
    const isAdmin = await RBACService.hasPermission(
      req.user!.id,
      'project_owners',
      'manage',
    );
    const isAgent = await RBACService.hasPermission(
      req.user!.id,
      'project_owners',
      'assign',
    );

    const isB2c = req.body.isB2cAssignment === true;

    // RBAC: Field agents (assign) can only create B2C assignments.
    // Admins (manage) can create both.
    if (!isAdmin) {
      if (!isAgent) {
        throw new AppError('You do not have permission to create assignments', 403);
      }
      if (!isB2c) {
        throw new AppError('Field agents cannot create B2B assignments', 403);
      }
    }

    // Business Logic: For B2B, the target agentId must also be an Admin (have manage permissions)
    if (!isB2c) {
      const targetIsAdmin = await RBACService.hasPermission(
        req.body.agentId,
        'project_owners',
        'manage',
      );
      if (!targetIsAdmin) {
        throw new AppError('B2B assignments must be assigned to an Admin (manage permission)', 400);
      }
    }

    const result = await ProjectOwnerAssignmentService.createAssignment({
      body:       req.body,
      assignedBy: req.user!.id,
    });

    return res.status(201).json({
      success: true,
      message: 'Assignment created successfully',
      data:    result,
    });
  }),

  /**
   * PUT /project-owner-assignments/:id
   *
   * An admin (project_owners:manage) OR the agent who made the assignment
   * (agentId === req.user.id) may update it.
   */
  updateAssignment: catchAsync(async (req: Request, res: Response) => {
    const isAdmin = await RBACService.hasPermission(
      req.user!.id,
      'project_owners',
      'manage',
    );

    const existing = await ProjectOwnerAssignmentService.getAssignmentById(
      req.params.id as string,
    );

    const isAssignedAgent = existing.agentId === req.user!.id;

    if (!isAdmin && !isAssignedAgent) {
      throw new AppError(
        'You are not authorized to update this assignment',
        403,
      );
    }

    const result = await ProjectOwnerAssignmentService.updateAssignment({
      params: { id: req.params.id as string },
      body:   req.body,
    });

    return res.status(200).json({
      success: true,
      message: 'Assignment updated successfully',
      data:    result,
    });
  }),

  /**
   * GET /project-owner-assignments/:id
   *
   * Any authenticated user may view a single assignment.
   */
  getAssignmentById: catchAsync(async (req: Request, res: Response) => {
    const result = await ProjectOwnerAssignmentService.getAssignmentById(
      req.params.id as string,
    );

    return res.status(200).json({
      success: true,
      message: 'Assignment fetched successfully',
      data:    result,
    });
  }),

  /**
   * GET /project-owner-assignments
   *
   * Restricted to admins (project_owners:manage) — internal listing.
   */
  listAssignments: catchAsync(async (req: Request, res: Response) => {
    const result = await ProjectOwnerAssignmentService.listAssignments(
      req.query as any,
    );

    return res.status(200).json({
      success:    true,
      message:    'Assignments fetched successfully',
      data:       result.data,
      nextCursor: result.nextCursor,
    });
  }),

  /**
   * DELETE /project-owner-assignments/:id
   *
   * Restricted to project_owners:manage.
   */
  deleteAssignment: catchAsync(async (req: Request, res: Response) => {
    await ProjectOwnerAssignmentService.deleteAssignment(req.params.id as string);
    return res.status(204).send();
  }),
};

export default ProjectOwnerAssignmentController;
