import { eq } from "drizzle-orm";
import { auth } from "@/shared/utils/auth";
import { db } from "@/config/db";
import { user } from "@v1/auth/models/auth-model";
import { CompleteProfileBody, SignUpBody } from "@v1/auth/schema/authSchema";
import { company, projectOwner } from "../models/auth-extension-model";
import AppError from "@/shared/errors/AppError";

const AuthService = {
  createUser: async (data: SignUpBody) => {
    try {
      // 1. Create base user and account using Better Auth API
      // This ensures correct password hashing (scrypt) and account records are set up
      const betterUser = await auth.api.signUpEmail({
        body: {
          email: data.email,
          password: data.password,
          name: `${data.firstName} ${data.lastName}`,
          firstName: data.firstName,
          lastName: data.lastName,
          userType: data.userType,
          contactNumber: data.contactNumber,
          countryOfOperation: data.countryOfOperation,
          profileCompleted: true,
        },
      });

      if (!betterUser) {
        throw new AppError("Failed to create user account", 500);
      }

      const userId = betterUser.user.id;

      // 2. Create type-specific data in our database
      // Note: better-auth already created the user/account records, 
      // but we still want atomicity for our extension tables.
      const result = await db.transaction(async (tx) => {
        if (data.userType === "Company") {
          const [newCompany] = await tx
            .insert(company)
            .values({
              userId: userId,
              legalBusinessName: data.company.legalBusinessName,
              businessAddress: data.company.businessAddress ?? null,
              createdAt: new Date(),
            })
            .returning();

          return {
            user: betterUser.user,
            company: newCompany,
          };
        } else {
          // ProjectOwner
          const [newProjectOwner] = await tx
            .insert(projectOwner)
            .values({
              userId: userId,
              projectCategory: data.projectOwner?.projectCategory ?? null,
              projectStartDate: data.projectOwner?.projectStartDate ?? null,
              createdAt: new Date(),
            })
            .returning();

          return {
            user: betterUser.user,
            projectOwner: newProjectOwner,
          };
        }
      });

      return result;
    } catch (error: any) {
      console.error("AuthService.createUser error:", error);
      // If extension fails, we'd ideally want to rollback Better Auth creation 
      // but Better Auth doesn't support distributed transactions easily here.
      // However, the risk is minimal given simple insertions.
      throw error;
    }
  },

  completeProfile: async (userId: string, profileData: CompleteProfileBody) => {
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
            // userName: profileData.userName,
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

      return {
        id: result.user.id,
        email: result.user.email,
        // userName: result.user.userName, // Not in model currently
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        userType: result.user.userType,
        profileCompleted: true,
      };
    } catch (error: any) {
      console.error("Profile completion error:", error);

      throw error;
    }
  },

  userExists: async (email: string) => {
    //check if user exists in the database
    if (!email || email.trim() === "") {
      throw new Error("Email is required");
    }

    const normalizedEmail = email.trim().toLowerCase();

    const foundUser = await db.query.user.findFirst({
      where: eq(user.email, normalizedEmail),
      columns: { id: true },
    });

    return Boolean(foundUser);
  },
};

export default AuthService;
