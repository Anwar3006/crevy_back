// src/v2/rbac/tests/rbac.test.ts
import { describe, expect, it, beforeEach } from "vitest";
import request from "supertest";
import app from "@/index";
import settings from "@/config/settings";
import { db } from "@/config/db";
import { permission, role, rolePermission } from "../models/rbac.model";
import { getAuthHeaders } from "@/tests/helper";
import { authHeaders, seedAdminPermissions } from "@/tests/setup";
import { ne } from "drizzle-orm";

const BASE = `/api/${settings.API_VERSION}/rbac`;

/**
 * ─── TEST ISOLATION STRATEGY ─────────────────────────────────────────────────
 *
 * beforeEach wipes all test-created data, then re-seeds the admin fixtures.
 *
 * WHY re-seed after wipe?
 *   `db.delete(rolePermission)` removes ALL rows including the admin's
 *   rbac:manage assignment created in setup.ts beforeAll. Without it, every
 *   request from the admin user returns 403 — not because auth failed, but
 *   because the permission check fails.
 *
 *   seedAdminPermissions() restores exactly that assignment so the admin
 *   can reach RBAC endpoints in every test.
 *
 * Each test is fully self-contained:
 *   - Creates only the data it specifically needs
 *   - Does not rely on data left behind by a previous test
 *   - Running the suite once or 1000 times produces identical results
 * ─────────────────────────────────────────────────────────────────────────────
 */

describe("RBAC Module", () => {
  beforeEach(async () => {
    // Clean up in FK dependency order: bridge table first, then the tables it references
    await db.delete(rolePermission);
    await db.delete(permission);
    await db.delete(role).where(ne(role.id, 1)); // keep admin role (id: 1)

    // Restore admin's rbac:manage permission — wiped by the delete above
    await seedAdminPermissions();
  });

  // ─── POST /roles ─────────────────────────────────────────────────────────

  describe(`POST ${BASE}/roles`, () => {
    it("should create a new role when given valid data", async () => {
      const res = await request(app)
        .post(`${BASE}/roles`)
        .set("Cookie", authHeaders.Cookie)
        .send({ name: "field_agent", description: "Manages farmers in the field" });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty("id");
      expect(res.body.data.name).toBe("field_agent");
    });

    it("should create a role without a description (description is optional)", async () => {
      const res = await request(app)
        .post(`${BASE}/roles`)
        .set("Cookie", authHeaders.Cookie)
        .send({ name: "verifier" });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe("verifier");
    });

    it("should return 409 when the role name already exists", async () => {
      const first = await request(app)
        .post(`${BASE}/roles`)
        .set("Cookie", authHeaders.Cookie)
        .send({ name: "field_agent" });
      expect(first.status).toBe(201);

      const res = await request(app)
        .post(`${BASE}/roles`)
        .set("Cookie", authHeaders.Cookie)
        .send({ name: "field_agent" });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Role with this name already exists");
    });

    it("should return 400 when name is missing", async () => {
      const res = await request(app)
        .post(`${BASE}/roles`)
        .set("Cookie", authHeaders.Cookie)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Invalid request data");
    });

    it("should return 401 when not authenticated", async () => {
      const res = await request(app)
        .post(`${BASE}/roles`)
        .send({ name: "test" }); // no Cookie header

      expect(res.status).toBe(401);
    });
  });

  // ─── POST /permissions ────────────────────────────────────────────────────

  describe(`POST ${BASE}/permissions`, () => {
    it("should create a permission", async () => {
      const res = await request(app)
        .post(`${BASE}/permissions`)
        .set("Cookie", authHeaders.Cookie)
        .send({ resource: "projects", action: "approve" });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty("id");
      expect(res.body.data.resource).toBe("projects");
      expect(res.body.data.action).toBe("approve");
    });

    it("should return 409 on duplicate resource + action", async () => {
      const first = await request(app)
        .post(`${BASE}/permissions`)
        .set("Cookie", authHeaders.Cookie)
        .send({ resource: "projects", action: "approve" });
      expect(first.status).toBe(201);

      const res = await request(app)
        .post(`${BASE}/permissions`)
        .set("Cookie", authHeaders.Cookie)
        .send({ resource: "projects", action: "approve" });

      expect(res.status).toBe(409);
    });

    it("should return 400 when resource is missing", async () => {
      const res = await request(app)
        .post(`${BASE}/permissions`)
        .set("Cookie", authHeaders.Cookie)
        .send({ action: "approve" }); // resource missing

      expect(res.status).toBe(400);
    });

    it("should return 400 when action is missing", async () => {
      const res = await request(app)
        .post(`${BASE}/permissions`)
        .set("Cookie", authHeaders.Cookie)
        .send({ resource: "projects" }); // action missing

      expect(res.status).toBe(400);
    });

    it("should return 401 when not authenticated", async () => {
      const res = await request(app)
        .post(`${BASE}/permissions`)
        .send({ resource: "projects", action: "approve" });

      expect(res.status).toBe(401);
    });
  });

  // ─── POST /roles/:roleId/permissions ──────────────────────────────────────

  describe(`POST ${BASE}/roles/:roleId/permissions`, () => {
    it("should assign a permission to a role", async () => {
      // Create a permission first — beforeEach wiped them all except rbac:manage
      const permRes = await request(app)
        .post(`${BASE}/permissions`)
        .set("Cookie", authHeaders.Cookie)
        .send({ resource: "projects", action: "approve" });
      expect(permRes.status).toBe(201);

      const res = await request(app)
        .post(`${BASE}/roles/1/permissions`)
        .set("Cookie", authHeaders.Cookie)
        .send({ permissionId: permRes.body.data.id });

      expect(res.status).toBe(200);
    });

    it("should return 409 when the same permission is assigned to the same role twice", async () => {
      const permRes = await request(app)
        .post(`${BASE}/permissions`)
        .set("Cookie", authHeaders.Cookie)
        .send({ resource: "projects", action: "approve" });

      const permissionId = permRes.body.data.id;

      const first = await request(app)
        .post(`${BASE}/roles/1/permissions`)
        .set("Cookie", authHeaders.Cookie)
        .send({ permissionId });
      expect(first.status).toBe(200);

      const res = await request(app)
        .post(`${BASE}/roles/1/permissions`)
        .set("Cookie", authHeaders.Cookie)
        .send({ permissionId });

      expect(res.status).toBe(409);
    });

    it("should return 400 when permissionId is missing from body", async () => {
      const res = await request(app)
        .post(`${BASE}/roles/1/permissions`)
        .set("Cookie", authHeaders.Cookie)
        .send({}); // no permissionId

      expect(res.status).toBe(400);
    });

    /**
     * 403 test — step by step:
     *
     * 1. The admin already has rbac:manage (re-seeded in beforeEach).
     * 2. Create a field_agent role (id: 2) and a user assigned to it.
     * 3. The field_agent user has NO permissions at all.
     * 4. field_agent calls POST /roles/1/permissions → requirePermission
     *    runs hasPermission(fieldAgentId, 'rbac', 'manage') → false → 403.
     */
    it("should return 403 when the user does not have rbac:manage permission", async () => {
      // Create field_agent role
      await db
        .insert(role)
        .values({ id: 2, name: "field_agent", description: "Field Agent" })
        .onConflictDoNothing();

      // Create a separate permission to be the assignment target
      const targetPermRes = await request(app)
        .post(`${BASE}/permissions`)
        .set("Cookie", authHeaders.Cookie)
        .send({ resource: "projects", action: "view" });
      expect(targetPermRes.status).toBe(201);

      // Sign in as field_agent — they have no permissions
      const nonAdminHeaders = await getAuthHeaders(2, {
        email:     "fieldagent@crevy-test.io",
        firstName: "Field",
        lastName:  "Agent",
      });

      // field_agent tries to assign a permission — must be refused
      const res = await request(app)
        .post(`${BASE}/roles/1/permissions`)
        .set("Cookie", nonAdminHeaders.Cookie)
        .send({ permissionId: targetPermRes.body.data.id });

      expect(res.status).toBe(403);
    });
  });

  // ─── DELETE /roles/:roleId/permissions/:permissionId ──────────────────────

  describe(`DELETE ${BASE}/roles/:roleId/permissions/:permissionId`, () => {
    it("should unassign a permission from a role", async () => {
      // Create and assign a permission
      const permRes = await request(app)
        .post(`${BASE}/permissions`)
        .set("Cookie", authHeaders.Cookie)
        .send({ resource: "projects", action: "delete" });
      expect(permRes.status).toBe(201);

      const permissionId = permRes.body.data.id;

      await request(app)
        .post(`${BASE}/roles/1/permissions`)
        .set("Cookie", authHeaders.Cookie)
        .send({ permissionId });

      // Now delete it
      const res = await request(app)
        .delete(`${BASE}/roles/1/permissions/${permissionId}`)
        .set("Cookie", authHeaders.Cookie);

      expect(res.status).toBe(204);
    });
  });
});
