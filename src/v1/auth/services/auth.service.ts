import { eq } from "drizzle-orm";
import { v7 as uuid7 } from "uuid";
import bcrypt from "bcrypt";

import { db } from "@/config/db";
import { account, user } from "@v1/auth/models/auth-model";
import { CompleteProfileBody, SignUpBody } from "@v1/auth/schema/authSchema";
import settings from "@/config/settings";
import { company, projectOwner } from "../models/auth-extension-model";
import AppError from "@/shared/errors/AppError";

const AuthService = {
  createUser: async (data: SignUpBody) => {
    const userId = uuid7();
    const hashedPassword = await bcrypt.hash(
      data.password,
      settings.SALT_WORK_FACTOR
    );

    try {
      // Execute everything in ONE atomic transaction
      const result = await db.transaction(async (tx) => {
        // 1. Create base user
        const [newUser] = await tx
          .insert(user)
          .values({
            id: userId,
            name: `${data.firstName} ${data.lastName}`,
            email: data.email,
            emailVerified: false,
            image: data.image ?? null,
            firstName: data.firstName,
            lastName: data.lastName,
            userName: data.userName,
            contactNumber: data.contactNumber ?? null,
            countryOfOperation: data.countryOfOperation ?? null,
            userType: data.userType,
            profileCompleted: true, // Email/password users have complete profiles
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // 2. Create account for password authentication
        await tx.insert(account).values({
          id: uuid7(),
          accountId: data.email,
          providerId: "credential",
          userId: userId,
          password: hashedPassword,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // 3. Create type-specific data based on userType
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
            user: newUser,
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
            user: newUser,
            projectOwner: newProjectOwner,
          };
        }
      });

      return result;
    } catch (error: unknown) {
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

      return {
        id: result.user.id,
        email: result.user.email,
        userName: result.user.userName,
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
