// src/v2/auth/schemas/auth.schema.ts
import { z } from "zod";

/**
 * Registration schema for v2.
 *
 * What changed from v1:
 *   - REMOVED: userType (Company / ProjectOwner / Admin discriminated union)
 *   - REMOVED: roleId — the backend assigns super_admin automatically for the pilot
 *   - REMOVED: conditional company / projectOwner / admin sub-objects
 *   - KEPT: firstName, lastName, email, password, contactNumber, countryOfOperation
 *
 * Every user who registers through this endpoint is assigned the super_admin role.
 * This will be refined after the investor demo once role-specific onboarding flows
 * are built.
 */
export const registerSchema = z.object({
  body: z.object({
    firstName:          z.string().min(2, "First name must be at least 2 characters").max(100),
    lastName:           z.string().min(2, "Last name must be at least 2 characters").max(100),
    email:              z.string().email("Invalid email address"),
    password:           z.string().min(6, "Password must be at least 6 characters").max(255),
    contactNumber:      z.string().min(10).max(15).optional(),
    countryOfOperation: z.string().min(2).max(100).optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email:    z.string().email("Invalid email address"),
    password: z.string().min(6).max(255),
  }),
});

export type TRegisterBody = z.infer<typeof registerSchema>["body"];
export type TLoginBody    = z.infer<typeof loginSchema>["body"];
