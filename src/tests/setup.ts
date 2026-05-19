// src/tests/setup.ts
import { beforeAll, afterAll } from "vitest";
import { db, prepareDB } from "@config/db";
import { permission, role, rolePermission } from "@/v2/parent-model";
import { AuthHeaders, getAuthHeaders } from "./helper";
import { and, eq, sql } from "drizzle-orm";

export let authHeaders: AuthHeaders;

export const seedAdminPermissions = async () => {
  const [existing] = await db
    .select()
    .from(permission)
    .where(and(eq(permission.resource, "rbac"), eq(permission.action, "manage")));

  let permId = existing?.id;

  if (!permId) {
    const [inserted] = await db
      .insert(permission)
      .values({ resource: "rbac", action: "manage", description: "System-wide RBAC management" })
      .returning();
    permId = inserted.id;
  }

  await db
    .insert(rolePermission)
    .values({ roleId: 1, permissionId: permId })
    .onConflictDoNothing();
};

beforeAll(async () => {
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS postgis;`);
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS btree_gist;`);
  await prepareDB();

  await db
    .insert(role)
    .values({ id: 1, name: "admin", description: "System Administrator" })
    .onConflictDoNothing();
    
  await db.execute(sql`SELECT setval(pg_get_serial_sequence('role', 'id'), (SELECT MAX(id) FROM role))`);

  authHeaders = await getAuthHeaders(1);
  await seedAdminPermissions();
});

afterAll(async () => {
  // To avoid dropping PostGIS extension every time, we just truncate all tables in public schema
  const tables = await db.execute(sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND table_name NOT IN ('spatial_ref_sys')
  `);

  if (tables.rows.length > 0) {
    const tableNames = tables.rows.map(r => `"${r.table_name}"`).join(', ');
    await db.execute(sql.raw(`TRUNCATE TABLE ${tableNames} CASCADE;`));
  }
});
