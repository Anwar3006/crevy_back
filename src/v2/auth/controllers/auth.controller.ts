// src/v2/auth/controllers/auth.controller.ts
import { Request, Response, NextFunction } from "express";
import { catchAsync } from "@/shared/errors/errorHandler";
import AppError from "@/shared/errors/AppError";
import AuthV2Service from "../services/auth.service";

const AuthV2Controller = {

  /**
   * POST /api/v2/auth/register
   *
   * Registers a new user. Assigns super_admin role automatically.
   * No userType field — roles drive access control in v2.
   */
  registerUser: catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await AuthV2Service.registerUser(req.body);

      return res.status(201).json({
        success: true,
        message: "Account created successfully",
        data:    result,
      });
    } catch (error: any) {
      // Surface AppErrors (409 duplicate, 500 better-auth failure) to the error handler
      if (error?.statusCode) return next(error);

      // Postgres unique constraint — belt-and-suspenders fallback
      if (error?.code === "23505") {
        return next(new AppError("An account with this email already exists", 409));
      }

      console.error("[AuthV2Controller.registerUser]", error);
      return next(new AppError("Registration failed. Please try again.", 500));
    }
  }),
};

export default AuthV2Controller;
