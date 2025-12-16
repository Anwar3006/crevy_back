import { readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import settings from "@config/settings";
import * as schema from "@v1/schema"; //importing all models from schema file
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const db = drizzle({
  connection: settings.DATABASE_URL,
  casing: "snake_case",
  schema: schema, //passing the imported schema here
});
const prepareDB = async () => {
  const migrationsDir = path.join(process.cwd(), "drizzle");
  const migrationFiles = await readdir(migrationsDir);
  if (migrationFiles.length === 0) {
    console.log("No migrations created yet");
    return;
  }
  await migrate(db, {
    migrationsFolder: "drizzle",
  });
  console.log("DB is ready with all models created from migrations");
};

export { db, prepareDB };
