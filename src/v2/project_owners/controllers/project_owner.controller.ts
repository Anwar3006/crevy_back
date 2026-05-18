// src/v2/project_owners/controllers/project_owner.controller.ts
import { catchAsync } from "@/shared/errors/errorHandler";
import { Request, Response } from "express";
import ProjectOwnerService from "../services/project_owner.service";
import RBACService from "@/v2/rbac/service/rbac.service";
import AppError from "@/shared/errors/AppError";

const ProjectOwnerController = {

  createProjectOwner: catchAsync(async (req: Request, res: Response) => {
    const isAdmin = await RBACService.hasPermission(
      req.user!.id,
      "project_owner",
      "manage"
    );
    const targetUserId = req.body.userId;

    // Security check: a non-admin can only register themselves
    if (!isAdmin && req.user!.id !== targetUserId) {
      throw new AppError(
        "You can only register a project owner profile for yourself",
        403
      );
    }

    const result = await ProjectOwnerService.createProjectOwner({
      userId:      targetUserId,
      adminId:     isAdmin ? req.user!.id : null,
      bankDetails: req.body.bankDetails,
      momoDetails: req.body.momoDetails,
    });

    return res.status(201).json({
      success: true,
      message: "Project owner created successfully",
      data: result,
    });
  }),

  updateProjectOwner: catchAsync(async (req: Request, res: Response) => {
    const isAdmin = await RBACService.hasPermission(
      req.user!.id,
      "project_owner",
      "manage"
    );
    const targetUserId = req.params.id as string;

    // Security check: a non-admin can only update themselves
    if (!isAdmin && req.user!.id !== targetUserId) {
      throw new AppError(
        "You can only update your own project owner profile",
        403
      );
    }

    const result = await ProjectOwnerService.updateProjectOwner({
      userId:      targetUserId,
      bankDetails: req.body.bankDetails,
      momoDetails: req.body.momoDetails,
    });

    return res.status(200).json({
      success: true,
      message: "Project owner updated successfully",
      data: result,
    });
  }),

  getProjectOwner: catchAsync(async (req: Request, res: Response) => {
    // Route param is the target user's ID, not a project_owner row ID
    const result = await ProjectOwnerService.getProjectOwner(req.params.id as string);

    return res.status(200).json({
      success: true,
      message: "Project owner fetched successfully",
      data: result,
    });
  }),

  listProjectOwners: catchAsync(async (req: Request, res: Response) => {
    const result = await ProjectOwnerService.listProjectOwners(req.query as any);

    return res.status(200).json({
      success: true,
      message: "Project owners fetched successfully",
      data: result.data,
      nextCursor: result.nextCursor,
    });
  }),

  deleteProjectOwner: catchAsync(async (req: Request, res: Response) => {
    await ProjectOwnerService.deleteProjectOwner(req.params.id as string);
    return res.status(204).send();
  }),
};

export default ProjectOwnerController;
