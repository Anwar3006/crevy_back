import { eq } from "drizzle-orm";
import { v7 as uuid7 } from "uuid";
import bcrypt from "bcrypt";

import { db } from "@/config/db";
import { account, user } from "@v1/auth/models/auth-model";
import { SignUpBody } from "@v1/auth/schema/authSchema";
import settings from "@/config/settings";
import { company, projectOwner } from "../models/auth-extension-model";

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
