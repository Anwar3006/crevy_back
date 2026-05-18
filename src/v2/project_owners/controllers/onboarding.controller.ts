import { catchAsync } from "@/shared/errors/errorHandler";
import { Request, Response } from "express";
import OnboardingService from "../services/onboarding.service";
import RBACService from "@/v2/rbac/service/rbac.service";
import AppError from "@/shared/errors/AppError";

const OnboardingController = {
  onboardProjectOwner: catchAsync(async (req: Request, res: Response) => {
    // Only admins or field agents with project_owners:manage can onboard
    const isAdmin = await RBACService.hasPermission(
      req.user!.id,
      "project_owner",
      "manage"
    );

    if (!isAdmin) {
      throw new AppError("You do not have permission to onboard project owners", 403);
    }

    const result = await OnboardingService.onboardProjectOwner(req.user!.id, req.body);

    return res.status(201).json({
      success: true,
      message: "Project owner onboarded successfully",
      data: result,
    });
  }),
};

export default OnboardingController;
