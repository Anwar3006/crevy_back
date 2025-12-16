import timestamps from "@shared/models/timestamp";
import { relations, sql } from "drizzle-orm";
import { pgEnum, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

// Define an enum for user types
export const userTypeEnum = pgEnum("user_type", ["ProjectOwner", "Company"]);

const users = pgTable("users", {
	// Primary Key (pk)
	id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

	// User Profile Information
	firstName: varchar({ length: 50 }).notNull(),
	lastName: varchar({ length: 50 }).notNull(),
	contactNumber: varchar({ length: 20 }),

	// Authentication and Unique Constraints
	userName: varchar({ length: 20 }).notNull().unique(),
	email: varchar({ length: 255 }).notNull().unique(),
	passwordHash: varchar({ length: 255 }).notNull(),

	// Operational Data
	countryOfOperation: varchar({ length: 100 }),

	// User Type -> Company or ProjectOwner
	userType: userTypeEnum("user_type").notNull(),

	// Timestamps
	...timestamps,
});

const company = pgTable("company", {
	userId: uuid()
		.references(() => users.id)
		.primaryKey(),
	legalBusinessName: varchar({ length: 100 }).notNull(),
	businessAddress: varchar({ length: 255 }),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

const projectOwner = pgTable("project_owner", {
	userId: uuid()
		.references(() => users.id)
		.primaryKey(),
	projectCategory: varchar({ length: 255 }),
	projectStartDate: varchar({ length: 255 }),

	createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Defines the relation between User -> Company & ProjectOwner -> allows us to use relational queries
const userRelations = relations(users, ({ one }) => ({
	company: one(company, {
		fields: [users.id],
		references: [company.userId],
	}),
	projectOwner: one(projectOwner, {
		fields: [users.id],
		references: [projectOwner.userId],
	}),
}));

const companyRelationWithUser = relations(company, ({ one }) => ({
	users: one(users, {
		fields: [company.userId],
		references: [users.id],
	}),
}));

const projectOwnerRelationWithUser = relations(projectOwner, ({ one }) => ({
	users: one(users, {
		fields: [projectOwner.userId],
		references: [users.id],
	}),
}));

export {
	users,
	company,
	projectOwner,
	userRelations,
	companyRelationWithUser,
	projectOwnerRelationWithUser,
};
