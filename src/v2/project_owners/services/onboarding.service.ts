import { db } from "@/config/db";
import { user, projectOwner, farmPlot, projectOwnerAssignment, role } from "@/v2/parent-model";
import { eq, or } from "drizzle-orm";
import AppError from "@/shared/errors/AppError";
import { TProjectOwnerOnboarding } from "../schemas/onboarding.schema";
import ProjectOwnerService from "./project_owner.service";
import { auth } from "@/shared/utils/auth";

const OnboardingService = {
  onboardProjectOwner: async (adminId: string, payload: TProjectOwnerOnboarding["body"]) => {
    const { 
      firstName, 
      lastName, 
      email, 
      contactNumber, 
      password, 
      countryOfOperation,
      bankDetails,
      momoDetails,
      farmPlot: farmPlotData,
      partnerId,
      assignmentType,
      isB2cAssignment
    } = payload;

    // 1. Check if user already exists
    const existingUser = await db.query.user.findFirst({
      where: (u, { or, eq }) => or(
        email ? eq(u.email, email) : undefined,
        eq(u.username, contactNumber)
      )
    });

    if (existingUser) {
      throw new AppError("User with this email or contact number already exists", 409);
    }

    // 2. Fetch project_owner role ID
    const [poRole] = await db.select().from(role).where(eq(role.name, "project_owner")).limit(1);
    if (!poRole) {
      throw new AppError("Project owner role not found. Please run seeders.", 500);
    }

    // 3. Create User via BetterAuth
    // If email is provided, use signUpEmail, otherwise we use signUpEmail with a dummy email or 
    // better yet, we might need a custom insert if better-auth doesn't support username-only signup easily via API.
    // Actually, BetterAuth username plugin supports signUpUsername.
    
    let betterUser;
    try {
      if (email) {
        betterUser = await auth.api.signUpEmail({
          body: {
            email,
            password,
            name: `${firstName} ${lastName}`,
            firstName,
            lastName,
            contactNumber,
            countryOfOperation,
            username: contactNumber, // Use contact number as username
            profileCompleted: true,
          }
        });
      } else {
        // BetterAuth username signup
        // @ts-ignore - plugin might not be typed in all environments
        betterUser = await auth.api.signUpUsername({
          body: {
            username: contactNumber,
            password,
            name: `${firstName} ${lastName}`,
            firstName,
            lastName,
            contactNumber,
            countryOfOperation,
            roleId: poRole.id,
            profileCompleted: true,
          }
        });
      }
    } catch (err: any) {
      throw new AppError(err.message || "Failed to create user account", 400);
    }

    if (!betterUser) {
      throw new AppError("Failed to create user account", 500);
    }

    const userId = betterUser.user.id;

    // 4. Atomic Transaction for extension tables
    return await db.transaction(async (tx) => {
      // a. Create Project Owner
      const code = await ProjectOwnerService.generateProjectOwnerCode();
      const [newPO] = await tx.insert(projectOwner).values({
        userId,
        code,
        onboardedBy: adminId,
        bankDetails: bankDetails ?? null,
        momoDetails: momoDetails ?? null,
      }).returning();

      // b. Create Farm Plot (if provided)
      let newPlot = null;
      if (farmPlotData) {
        const [insertedPlot] = await tx.insert(farmPlot).values({
          projectOwnerId: newPO.id,
          country: countryOfOperation,
          region: farmPlotData.region,
          village: farmPlotData.village ?? null,
          centroid: `POINT(${farmPlotData.centroid.lng} ${farmPlotData.centroid.lat})`,
          areaHectares: farmPlotData.areaHectares.toString(),
          boundaryCollectionMethod: "buffered_centroid", // Default for initial capture
        }).returning();
        newPlot = insertedPlot;
      }

      // c. Create Assignment
      const [newAssignment] = await tx.insert(projectOwnerAssignment).values({
        projectOwnerId: newPO.id,
        agentId: adminId,
        assignedBy: adminId,
        partnerId: partnerId ?? null,
        assignmentType,
        isB2cAssignment,
      }).returning();

      return {
        user: betterUser.user,
        projectOwner: newPO,
        farmPlot: newPlot,
        assignment: newAssignment
      };
    });
  }
};

export default OnboardingService;
