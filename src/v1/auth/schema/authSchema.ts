import type { InferSelectModel } from "drizzle-orm";
import { createSelectSchema } from "drizzle-zod";
import z from "zod";
import { company, projectOwner } from "@v1/auth/models/auth-extension-model";
import { user } from "@v1/auth/models/auth-model";

// ============================================================================
// SIGN UP SCHEMAS (Registration)
// ============================================================================

/**
 * Base user schema for sign-up
 * Contains all fields that a user must/can provide during registration
 * Excludes auto-generated fields (id, name, emailVerified, timestamps)
 */
const baseUserSignUpSchema = z.object({
  // Required fields
  email: z.email("Invalid email format").toLowerCase().trim(),

  firstName: z
    .string()
    .min(1, "First name is required")
    .max(50, "First name must not exceed 50 characters")
    .trim(),

  lastName: z
    .string()
    .min(1, "Last name is required")
    .max(50, "Last name must not exceed 50 characters")
    .trim(),

  // userName: z
  //   .string()
  //   .min(3, "Username must be at least 3 characters")
  //   .max(20, "Username must not exceed 20 characters")
  //   .regex(
  //     /^[a-zA-Z0-9_]+$/,
  //     "Username can only contain letters, numbers, and underscores",
  //   )
  //   .trim(),

  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password must not exceed 100 characters"),

  // Optional fields
  image: z.url("Invalid image URL").optional().nullable(),

  phoneNumber: z.string().max(20, "Phone number must not exceed 20 characters"),
  sex: z.enum(["Male", "Female", "Other"]).optional(),

  contactNumber: z
    .string()
    .max(20, "Contact number must not exceed 20 characters")
    .optional(),

  countryOfOperation: z
    .string()
    .max(100, "Country must not exceed 100 characters")
    .optional(),
});

/**
 * Company-specific data schema
 * Used when registering a Company type user
 */
const companyDataSchema = z.object({
  legalBusinessName: z
    .string()
    .min(1, "Legal business name is required")
    .max(100, "Legal business name must not exceed 100 characters")
    .trim(),

  businessAddress: z
    .string()
    .max(255, "Business address must not exceed 255 characters")
    .trim()
    .optional(),
});

/**
 * ProjectOwner-specific data schema
 * Used when registering a ProjectOwner type user
 * All fields are optional
 */
const projectOwnerDataSchema = z
  .object({
    projectCategory: z
      .string()
      .max(255, "Project category must not exceed 255 characters")
      .trim()
      .optional(),

    projectStartDate: z
      .string()
      .max(255, "Project start date must not exceed 255 characters")
      .trim()
      .optional(),
  })
  .optional();

/**
 * Company user sign-up schema
 * Combines base user fields with company-specific data
 */
const companyUserSignUpSchema = baseUserSignUpSchema.extend({
  userType: z.literal("Company"),
  company: companyDataSchema,
});

/**
 * ProjectOwner user sign-up schema
 * Combines base user fields with project owner-specific data
 */
const projectOwnerUserSignUpSchema = baseUserSignUpSchema.extend({
  userType: z.literal("ProjectOwner"),
  projectOwner: projectOwnerDataSchema,
});

/**
 * Complete sign-up schema with discriminated union
 * Wrapped in body object for validation middleware
 * Use this for the registration endpoint
 */
export const signUpSchema = z.object({
  body: z.discriminatedUnion("userType", [
    companyUserSignUpSchema,
    projectOwnerUserSignUpSchema,
  ]),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignUpBody = z.infer<typeof signUpSchema.shape.body>;

// ============================================================================
// SIGN IN SCHEMA (Login)
// ============================================================================

/**
 * Sign-in schema for email/password authentication
 * Wrapped in body object for validation middleware
 */
export const signInSchema = z.object({
  body: z.object({
    email: z.email("Invalid email format").toLowerCase().trim(),

    password: z.string().min(1, "Password is required"),
  }),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignInBody = z.infer<typeof signInSchema.shape.body>;

// ============================================================================
// DATABASE TYPES (for type-safety with Drizzle queries)
// ============================================================================

export type UserDB = InferSelectModel<typeof user>;
export type CompanyDB = InferSelectModel<typeof company>;
export type ProjectOwnerDB = InferSelectModel<typeof projectOwner>;

// ============================================================================
// APPLICATION TYPES (for logged-in users)
// ============================================================================

/**
 * Schema for selecting a user from database
 * Used for type-safe user objects returned from queries
 */
export const selectUserSchema = createSelectSchema(user);
export type SelectUserSchema = z.infer<typeof selectUserSchema>;

/**
 * Base user type without type-specific data
 */
export type BaseUser = SelectUserSchema & {
  company?: never;
  projectOwner?: never;
};

/**
 * Company user type with company data
 */
export type CompanyUser = SelectUserSchema & {
  userType: "Company";
  company: CompanyDB;
  projectOwner?: never;
};

/**
 * ProjectOwner user type with project owner data
 */
export type ProjectOwnerUser = SelectUserSchema & {
  userType: "ProjectOwner";
  projectOwner: ProjectOwnerDB;
  company?: never;
};

/**
 * Union type for all possible user types
 * Use this to type logged-in user objects in your application
 */
export type TUser = CompanyUser | ProjectOwnerUser;

// ============================================================================
// PROFILE COMPLETION SCHEMA (for social login users)
// ============================================================================

/**
 * Profile completion schema for users who signed up via social providers
 * This collects the required data that wasn't available during OAuth
 */
export const completeProfileSchema = z.object({
  body: z.discriminatedUnion("userType", [
    z.object({
      userType: z.literal("Company"),
      userName: z
        .string()
        .min(3, "Username must be at least 3 characters")
        .max(20, "Username must not exceed 20 characters")
        .regex(
          /^[a-zA-Z0-9_]+$/,
          "Username can only contain letters, numbers, and underscores",
        )
        .trim(),
      contactNumber: z
        .string()
        .max(20, "Contact number must not exceed 20 characters")
        .optional(),
      countryOfOperation: z
        .string()
        .max(100, "Country must not exceed 100 characters")
        .optional(),
      company: companyDataSchema,
    }),
    z.object({
      userType: z.literal("ProjectOwner"),
      userName: z
        .string()
        .min(3, "Username must be at least 3 characters")
        .max(20, "Username must not exceed 20 characters")
        .regex(
          /^[a-zA-Z0-9_]+$/,
          "Username can only contain letters, numbers, and underscores",
        )
        .trim(),
      contactNumber: z
        .string()
        .max(20, "Contact number must not exceed 20 characters")
        .optional(),
      countryOfOperation: z
        .string()
        .max(100, "Country must not exceed 100 characters")
        .optional(),
      projectOwner: projectOwnerDataSchema,
    }),
  ]),
});

export type CompleteProfileInput = z.infer<typeof completeProfileSchema>;
export type CompleteProfileBody = z.infer<
  typeof completeProfileSchema.shape.body
>;

// ============================================================================
// ADDITIONAL SCHEMAS (Update, etc.)
// ============================================================================

/**
 * Schema for updating user profile
 * Can be expanded based on what fields users can update
 */
export const updateUserSchema = z.object({
  body: z.object({
    firstName: z
      .string()
      .min(1, "First name is required")
      .max(50, "First name must not exceed 50 characters")
      .trim()
      .optional(),

    lastName: z
      .string()
      .min(1, "Last name is required")
      .max(50, "Last name must not exceed 50 characters")
      .trim()
      .optional(),

    image: z.string().url("Invalid image URL").optional(),

    contactNumber: z
      .string()
      .max(20, "Contact number must not exceed 20 characters")
      .optional(),

    countryOfOperation: z
      .string()
      .max(100, "Country must not exceed 100 characters")
      .optional(),
  }),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
