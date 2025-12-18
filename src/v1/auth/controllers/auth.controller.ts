import { Request, Response, NextFunction } from "express";
import { db } from "@/config/db";
import AppError from "@/shared/errors/AppError.js";
import { catchAsync } from "@/shared/errors/errorHandler";
import { SignUpBody, CompleteProfileBody, TUser } from "../schema/authSchema";
import { user, account } from "../models/auth-model";
import { company, projectOwner } from "../models/auth-extension-model";
import { v7 as uuid7 } from "uuid";
import bcrypt from "bcrypt";
import AuthService from "../services/auth.service";
import { eq } from "drizzle-orm";
import { TResponsePayload } from "@/shared/types";
import settings from "@/config/settings";

const AuthController = {
  /**
   * Register a new user with email/password - Full atomic transaction
   * POST /api/v1/auth/register
   */
  registerUser: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
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
    async (req: Request, res: Response, next: NextFunction) => {
      const profileData = req.body as CompleteProfileBody;

      // Get authenticated user ID from session/token
      // You'll need to implement auth middleware to extract this
      const userId = (req as any).user?.id;

      if (!userId) {
        return next(new AppError("Unauthorized. Please login first.", 401));
      }

      try {
        // Execute profile completion in ONE atomic transaction
        const result = await db.transaction(async (tx) => {
          // 1. Get current user to verify they need profile completion
          const [currentUser] = await tx
            .select()
            .from(user)
            .where(eq(user.id, userId))
            .limit(1);

          if (!currentUser) {
            throw new AppError("User not found", 404);
          }

          if (currentUser.profileCompleted) {
            throw new AppError("Profile already completed", 400);
          }

          // 2. Parse name from existing name field (set by OAuth)
          const nameParts = currentUser.name.split(" ");
          const firstName = nameParts[0] || "";
          const lastName = nameParts.slice(1).join(" ") || "";

          // 3. Update user with profile completion data
          const [updatedUser] = await tx
            .update(user)
            .set({
              firstName: firstName,
              lastName: lastName,
              userName: profileData.userName,
              userType: profileData.userType,
              contactNumber: profileData.contactNumber ?? null,
              countryOfOperation: profileData.countryOfOperation ?? null,
              profileCompleted: true,
              updatedAt: new Date(),
            })
            .where(eq(user.id, userId))
            .returning();

          // 4. Create type-specific data
          if (profileData.userType === "Company") {
            const [newCompany] = await tx
              .insert(company)
              .values({
                userId: userId,
                legalBusinessName: profileData.company.legalBusinessName,
                businessAddress: profileData.company.businessAddress ?? null,
                createdAt: new Date(),
              })
              .returning();

            return {
              user: updatedUser,
              company: newCompany,
            };
          } else {
            // ProjectOwner
            const [newProjectOwner] = await tx
              .insert(projectOwner)
              .values({
                userId: userId,
                projectCategory:
                  profileData.projectOwner?.projectCategory ?? null,
                projectStartDate:
                  profileData.projectOwner?.projectStartDate ?? null,
                createdAt: new Date(),
              })
              .returning();

            return {
              user: updatedUser,
              projectOwner: newProjectOwner,
            };
          }
        });

        return res.status(200).json({
          success: true,
          message: "Profile completed successfully",
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
    async (req: Request, res: Response, next: NextFunction) => {
      // const loginData = req.body as LoginBody;
    }
  ),

  logoutUser: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      // const loginData = req.body as LoginBody;
    }
  ),
};

export default AuthController;
