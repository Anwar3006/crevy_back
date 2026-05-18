// src/v2/auth/services/auth.service.ts
import { eq } from "drizzle-orm";
import { db } from "@/config/db";
import { auth } from "@/shared/utils/auth";
import { user } from "@/v2/auth/models/auth.model";
import { role } from "@/v2/rbac/models/rbac.model";
import AppError from "@/shared/errors/AppError";
import type { TRegisterBody } from "../schemas/auth.schema";

const AuthV2Service = {

  /**
   * registerUser
   *
   * Creates a new user via better-auth then assigns the super_admin role.
   *
   * Flow:
   *   1. Call better-auth signUpEmail — this handles password hashing,
   *      session creation, and writes the user row correctly via the drizzle adapter.
   *   2. Look up the super_admin role ID from the role table.
   *   3. Patch the user row with roleId = super_admin.id.
   *
   * roleId has input:false in the better-auth config so it cannot be passed
   * through signUpEmail. We write it directly via drizzle after creation.
   *
   * For the pilot every registrant becomes super_admin. This will be refined
   * after the demo when role-specific onboarding flows are built.
   */
  registerUser: async (data: TRegisterBody) => {
    // 1. Check if the email is already registered
    const existing = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, data.email))
      .limit(1);

    if (existing.length > 0) {
      throw new AppError("An account with this email already exists", 409);
    }

    // 2. Create the user via better-auth
    //    better-auth handles password hashing and writes session/account rows.
    const result = await auth.api.signUpEmail({
      body: {
        name:               `${data.firstName} ${data.lastName}`,
        email:              data.email,
        password:           data.password,
        firstName:          data.firstName,
        lastName:           data.lastName,
        contactNumber:      data.contactNumber ?? null,
        countryOfOperation: data.countryOfOperation ?? null,
      },
    });

    if (!result?.user) {
      throw new AppError("Failed to create user account. Please try again.", 500);
    }

    // 3. Resolve the super_admin role ID
    //    The role is seeded by `src/v2/seed.ts`. If it doesn't exist yet
    //    (unseeded environment) we skip the roleId assignment gracefully.
    const [superAdminRole] = await db
      .select({ id: role.id })
      .from(role)
      .where(eq(role.name, "super_admin"))
      .limit(1);

    if (superAdminRole) {
      await db
        .update(user)
        .set({ roleId: superAdminRole.id })
        .where(eq(user.id, result.user.id));
    } else {
      // Log a warning — the seed hasn't been run yet.
      // The user is still created, just without a role.
      console.warn(
        "[AuthV2Service] super_admin role not found. " +
        "Run `pnpm db:seed` to seed roles. User created without roleId."
      );
    }

    return {
      id:        result.user.id,
      email:     result.user.email,
      firstName: data.firstName,
      lastName:  data.lastName,
      roleId:    superAdminRole?.id ?? null,
    };
  },
};

export default AuthV2Service;
