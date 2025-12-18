import { Request, Response, NextFunction } from "express";
import { db } from "@/config/db";
import AppError from "@/shared/errors/AppError.js";
import { catchAsync } from "@/shared/errors/errorHandler";
import {
  SignUpBody,
  CompleteProfileBody,
  TUser,
  SignInBody,
  UserDB,
} from "../schema/authSchema";
import { user } from "../models/auth-model";
import { company, projectOwner } from "../models/auth-extension-model";

import AuthService from "../services/auth.service";
import { eq } from "drizzle-orm";
import {
  TResponsePayload,
  TSignInSuccess,
  TSignUpSuccess,
} from "@/shared/types";

import { auth } from "@/shared/utils/auth";

const AuthController = {
  /**
   * Register a new user with email/password - Full atomic transaction
   * POST /api/v1/auth/register
   */
  registerUser: catchAsync(
    async (
      req: Request,
      res: Response<TResponsePayload<TSignUpSuccess>>,
      next: NextFunction
    ) => {
      const registerData = req.body as SignUpBody;

      // Check if user already exists (before starting transaction)
      if (await AuthService.userExists(registerData.email)) {
        return next(new AppError("User already exists", 409));
      }

      try {
        const result = await AuthService.createUser(registerData);

        // If we reach here, EVERYTHING succeeded atomically
        return res.status(201).json({
          success: true,
          message: "User registered successfully",
          data: {
            id: result.user.id,
            email: result.user.email,
            userName: result.user.userName,
            firstName: result.user.firstName,
            lastName: result.user.lastName,
            userType: result.user.userType,
            profileCompleted: true,
          },
        });
      } catch (error: any) {
        // If ANYTHING fails, the ENTIRE transaction is rolled back
        console.error("Registration error:", error);

        // Handle specific errors
        if (error.code === "23505") {
          // Unique constraint violation (duplicate email or username)
          return next(new AppError("Email or username already exists", 409));
        }

        return next(
          new AppError("Failed to create user. Please try again.", 500)
        );
      }
    }
  ),

  /**
   * Complete profile for social login users - Atomic transaction
   * POST /api/v1/auth/complete-profile
   * Requires authentication
   */
  completeProfile: catchAsync(
    async (
      req: Request,
      res: Response<TResponsePayload<TSignUpSuccess>>,
      next: NextFunction
    ) => {
      const profileData = req.body as CompleteProfileBody;

      // Get authenticated user ID from session/token
      // You'll need to implement auth middleware to extract this
      const userId = (req as any).user?.id;

      if (!userId) {
        return next(new AppError("Unauthorized. Please login first.", 401));
      }

      try {
        // Execute profile completion in ONE atomic transaction
        const result = await AuthService.completeProfile(userId, profileData);

        return res.status(200).json({
          success: true,
          message: "Profile completed successfully",
          data: {
            id: result.id,
            email: result.email,
            userName: result.userName,
            firstName: result.firstName,
            lastName: result.lastName,
            userType: result.userType,
            profileCompleted: true,
          },
        });
      } catch (error: any) {
        console.error("Profile completion error:", error);

        if (error instanceof AppError) {
          return next(error);
        }

        if (error.code === "23505") {
          return next(new AppError("Username already exists", 409));
        }

        return next(
          new AppError("Failed to complete profile. Please try again.", 500)
        );
      }
    }
  ),

  loginUser: catchAsync(
    async (
      req: Request,
      res: Response<TResponsePayload<TSignInSuccess>>,
      next: NextFunction
    ) => {
      const loginData = req.body as SignInBody;

      //this time we can simply use the betterAuth api
      const result = await auth.api.signInEmail({
        body: {
          email: loginData.email,
          password: loginData.password,
        },
      });

      return res.status(200).json({
        success: true,
        message: "User logged in successfully",
        data: {
          ...result,
          user: {
            ...result.user,
            image: result.user.image as string,
            contactNumber: result.user.contactNumber as string,
            countryOfOperation: result.user.countryOfOperation as string,
            userType: result.user.userType as "ProjectOwner" | "Company",
          },
        },
      });
    }
  ),

  logoutUser: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      // const loginData = req.body as LoginBody;
    }
  ),
};

export default AuthController;
