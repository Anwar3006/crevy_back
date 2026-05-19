import { catchAsync } from "@/shared/errors/errorHandler";
import { Request, Response } from "express";
import FarmPlotService from "../services/farm_plot.service";
import ProjectOwnerService from "../services/project_owner.service";
import RBACService from "@/v2/rbac/service/rbac.service";
import AppError from "@/shared/errors/AppError";

const FarmPlotController = {

  createFarmPlot: catchAsync(async (req: Request, res: Response) => {
    const { projectOwnerId } = req.body;
    
    // Check if the current user is the admin assigned to this project owner
    const po = await ProjectOwnerService.getProjectOwnerById(projectOwnerId);
    
    const isAssignedAdmin = po.onboardedBy === req.user!.id;
    const isSuperAdmin = await RBACService.hasPermission(req.user!.id, "project_owner", "manage");

    if (!isAssignedAdmin && !isSuperAdmin) {
      throw new AppError("You are not authorized to manage plots for this project owner", 403);
    }

    const result = await FarmPlotService.createFarmPlot({ body: req.body });

    return res.status(201).json({
      success: true,
      message: "Farm plot created successfully",
      data: result,
    });
  }),

  updateFarmPlot: catchAsync(async (req: Request, res: Response) => {
    const plot = await FarmPlotService.getFarmPlotById(req.params.id as string);
    const po = await ProjectOwnerService.getProjectOwnerById(plot.projectOwnerId);

    const isAssignedAdmin = po.onboardedBy === req.user!.id;
    const isSuperAdmin = await RBACService.hasPermission(req.user!.id, "project_owner", "manage");

    if (!isAssignedAdmin && !isSuperAdmin) {
      throw new AppError("You are not authorized to manage plots for this project owner", 403);
    }

    const result = await FarmPlotService.updateFarmPlot({
      body: req.body,
      params: { id: req.params.id as string },
    });

    return res.status(200).json({
      success: true,
      message: "Farm plot updated successfully",
      data: result,
    });
  }),

  getFarmPlotById: catchAsync(async (req: Request, res: Response) => {
    const result = await FarmPlotService.getFarmPlotById(req.params.id as string);

    return res.status(200).json({
      success: true,
      message: "Farm plot fetched successfully",
      data: result,
    });
  }),

  getFarmPlots: catchAsync(async (req: Request, res: Response) => {
    // Check if user has admin:view or project_owners:manage
    // Actually user said "fetch all farm_plots with cursor pagination this will be internal to only admin:view"
    const canViewAll = await RBACService.hasPermission(req.user!.id, "admin", "view");
    
    if (!canViewAll) {
       throw new AppError("You do not have permission to list all farm plots", 403);
    }

    const result = await FarmPlotService.getFarmPlots(req.query as any);

    return res.status(200).json({
      success: true,
      message: "Farm plots fetched successfully",
      data: result.data,
      nextCursor: result.nextCursor,
    });
  }),

  deleteFarmPlot: catchAsync(async (req: Request, res: Response) => {
    const plot = await FarmPlotService.getFarmPlotById(req.params.id as string);
    const po = await ProjectOwnerService.getProjectOwnerById(plot.projectOwnerId);

    const isAssignedAdmin = po.onboardedBy === req.user!.id;
    const isSuperAdmin = await RBACService.hasPermission(req.user!.id, "project_owner", "manage");

    if (!isAssignedAdmin && !isSuperAdmin) {
      throw new AppError("You are not authorized to manage plots for this project owner", 403);
    }

    await FarmPlotService.deleteFarmPlot(req.params.id as string);
    return res.status(204).send();
  }),
};

export default FarmPlotController;
