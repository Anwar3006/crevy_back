// src/v2/rbac/controller/rbac.controller.ts
import { catchAsync } from "@/shared/errors/errorHandler";
import { NextFunction, Request, Response } from "express";
import RBACService from "../service/rbac.service";

/**
 * All input validation is handled upstream by validateInboundRequest (Zod).
 * By the time any handler here runs, req.body and req.params are already
 * validated and type-safe — no manual `if (!field)` checks needed.
 */
const RBACController = {

  createRole: catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
    const { name, description } = req.body;
    const role = await RBACService.createRole({ name, description });

    return res.status(201).json({
      success: true,
      message: "Role created successfully",
      data: role,
    });
  }),

  createPermission: catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
    const { resource, action, description } = req.body;
    const perm = await RBACService.createPermission({ resource, action, description });

    return res.status(201).json({
      success: true,
      message: "Permission created successfully",
      data: perm,
    });
  }),

  assignPermissionToRole: catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
    const roleId      = Number(req.params.roleId);
    const permissionId = Number(req.body.permissionId);
    const grantedBy   = req.user!.id;

    const result = await RBACService.assignPermissionToRole({ roleId, permissionId, grantedBy });

    return res.status(200).json({
      success: true,
      message: "Permission assigned to role successfully",
      data: result,
    });
  }),

  unassignPermissionFromRole: catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
    const roleId       = Number(req.params.roleId);
    const permissionId = Number(req.params.permissionId);

    await RBACService.unassignPermissionFromRole(roleId, permissionId);

    return res.status(204).send();
  }),

  getUserRole: catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
    const userId = req.user!.id;
    const roleName = await RBACService.getUserRole(userId);

    return res.status(200).json({
      success: true,
      data: { role: roleName },
    });
  }),
};

export default RBACController;
