import timestamps from "@shared/models/timestamp";
import { pgTable, uuid, varchar } from "drizzle-orm/pg-core";

const authModel = pgTable("auth", {
  id: uuid().primaryKey(),
  userName: varchar({ length: 20 }).notNull().unique(),
  firstName: varchar({ length: 30 }).notNull(),
  lastName: varchar({ length: 30 }).notNull(),
  email: varchar({ length: 255 }).notNull().unique(),
  ...timestamps,
});

export default authModel;
