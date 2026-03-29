import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { user } from "./auth-model";
import { relations } from "drizzle-orm";

export const company = pgTable("company", {
  userId: text()
    .references(() => user.id)
    .primaryKey(),
  legalBusinessName: varchar({ length: 100 }).notNull(),
  businessAddress: varchar({ length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const projectOwner = pgTable("project_owner", {
  userId: text()
    .references(() => user.id)
    .primaryKey(),
  projectCategory: varchar({ length: 255 }),
  projectStartDate: varchar({ length: 255 }),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const admin = pgTable("admin", {
  userId: text()
    .references(() => user.id)
    .primaryKey(),
  assignedBusinessId: text().references(() => user.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const companyRelationWithUser = relations(company, ({ one }) => ({
  users: one(user, {
    fields: [company.userId],
    references: [user.id],
  }),
}));

export const projectOwnerRelationWithUser = relations(
  projectOwner,
  ({ one }) => ({
    users: one(user, {
      fields: [projectOwner.userId],
      references: [user.id],
    }),
  })
);

export const adminRelationWithUser = relations(admin, ({ one }) => ({
  users: one(user, {
    fields: [admin.userId],
    references: [user.id],
  }),
  assignedBusiness: one(user, {
    fields: [admin.assignedBusinessId],
    references: [user.id],
  }),
}));
