// src/tests/setup.ts
import { beforeAll, afterAll } from "vitest";
import { db, prepareDB } from "@config/db";
import { permission, role, rolePermission } from "@/v2/parent-model";
import { AuthHeaders, getAuthHeaders } from "./helper";
import { and, eq, sql } from "drizzle-orm";

// ─── Exported auth headers ───────────────────────────────────────────────────
// Assigned once in beforeAll and shared across every test file.
// Import this wherever you need a pre-authenticated admin cookie.
export let authHeaders: AuthHeaders;

/**
 * seedAdminPermissions
 *
 * Seeds the minimum permission set that the admin role (id: 1) needs to call
 * RBAC management endpoints. Call this from the `beforeEach` of any test file
 * that wipes the rolePermission / permission tables — otherwise the admin
 * will have no permissions and every authenticated request will return 403.
 *
 * It is idempotent: safe to call multiple times (uses onConflictDoNothing).
 */
export const seedAdminPermissions = async () => {
  // Seed the permission row
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

  // Assign it to admin role (id: 1)
  await db
    .insert(rolePermission)
    .values({ roleId: 1, permissionId: permId })
    .onConflictDoNothing();
};

// ─── Global setup ────────────────────────────────────────────────────────────

beforeAll(async () => {
  // 1. Run any pending migrations against the test database
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS postgis;`);
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS btree_gist;`);
  await prepareDB();

  // 2. Seed the admin role — safe to run on every test run
  await db
    .insert(role)
    .values({ id: 1, name: "admin", description: "System Administrator" })
    .onConflictDoNothing();
    
  // Advance the sequence so future role inserts (which use default id) don't conflict with id=1
  await db.execute(sql`SELECT setval(pg_get_serial_sequence('role', 'id'), (SELECT MAX(id) FROM role))`);

  // 3. Create the admin test user and capture the session cookie.
  //    getAuthHeaders is idempotent — if the user already exists it signs in.
  authHeaders = await getAuthHeaders(1);

  // 4. Seed the rbac:manage permission so the admin can reach RBAC endpoints
  await seedAdminPermissions();
});

afterAll(async () => {
  // Tear down all tables to ensure a clean slate for the next test run
  await db.execute(sql`DROP SCHEMA public CASCADE;`);
  await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE;`);
  await db.execute(sql`CREATE SCHEMA public;`);
  await db.execute(sql`GRANT ALL ON SCHEMA public TO public;`);
});
