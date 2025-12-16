import { company, projectOwner, users } from "@v1/auth/models/userModel";
import type { InferSelectModel } from "drizzle-orm";
import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-zod";
import z from "zod";

// Omit passwordHash, for creating a user we want to accept password instead
// The passwordHash is stored in the database, we do not want users to send a hashed password, we will hash it on the server side
// The below schema omits passwordHash and adds password field, to be used when creating a user
export const createUserSchema = createInsertSchema(users)
	.omit({
		passwordHash: true,
	})
	.extend({
		password: z.string().min(8),
	});
export type CreateUserInputSchema = z.infer<typeof createUserSchema>;
// Use the above to type the input to the API for creating a user

// Schema for updating a user
export const updateUserSchema = createUpdateSchema(users).omit({
	passwordHash: true,
});
export type UpdateUserInputSchema = z.infer<typeof updateUserSchema>;
// Use the above to type the input to the API for updating a user

// Schema for selecting a user - omit passwordHash
export const selectUserSchema = createSelectSchema(users).omit({
	passwordHash: true,
});
export type SelectUserInputSchema = z.infer<typeof selectUserSchema>;
// This can be used to type the user object returned from the database, without the passwordHash
// We use it with the BaseUser type below

// Used when creating a typed user (Company or ProjectOwner)
export const createCompanyUserSchema = createUserSchema.extend({
	userType: z.literal("Company"),
	company: createInsertSchema(company),
});

export const createProjectOwnerUserSchema = createUserSchema.extend({
	userType: z.literal("ProjectOwner"),
	projectOwner: createInsertSchema(projectOwner),
});

export const createTypedUserSchema = z.discriminatedUnion("userType", [
	createCompanyUserSchema,
	createProjectOwnerUserSchema,
]);
export type CreateTypedUserInput = z.infer<typeof createTypedUserSchema>;

// Use these types to type the query results from the database
export type UserDB = InferSelectModel<typeof users>;
export type CompanyDB = InferSelectModel<typeof company>;
export type ProjectOwnerDB = InferSelectModel<typeof projectOwner>;

export type BaseUser = SelectUserInputSchema & {
	company?: never;
	projectOwner?: never;
};

export type CompanyUser = BaseUser & {
	userType: "Company";
	company: CompanyDB;
};

export type ProjectOwnerUser = BaseUser & {
	userType: "ProjectOwner";
	projectOwner: ProjectOwnerDB;
};

// Use this to type an object for a logged-in user
export type TUser = CompanyUser | ProjectOwnerUser;
