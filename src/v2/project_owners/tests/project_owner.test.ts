// src/v2/project_owners/tests/project_owner.test.ts
import settings from "@/config/settings";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app from "@/index";
import { authHeaders, seedAdminPermissions } from "@/tests/setup";
import { getAuthHeaders } from "@/tests/helper";
import { db } from "@/config/db";
import { permission, projectOwner, role, rolePermission, user } from "@/v2/parent-model";
import { and, eq, gt, isNull, ne, or } from "drizzle-orm";

const BASE = `/api/${settings.API_VERSION}/project-owners`;

/**
 * ─── TEST ISOLATION STRATEGY ─────────────────────────────────────────────────
 *
 * beforeEach:
 *   1. Wipe all project_owner rows.
 *   2. Wipe all rolePermission rows (to avoid FK conflicts).
 *   3. Wipe all permission rows except rbac:manage.
 *   4. Wipe all role rows except admin (id: 1).
 *   5. Wipe all users except the authenticated test user (admin).
 *   6. Re-seed admin's rbac:manage assignment.
 *
 * Each test creates exactly the roles/permissions it needs and no more.
 * Running the suite once or 1000 times produces identical results.
 * ─────────────────────────────────────────────────────────────────────────────
 */

describe("Project Owner Module", () => {

  beforeEach(async () => {
    // 1. Wipe project owner rows
    await db.delete(projectOwner);

    // 2. Wipe bridge table first (FK references role + permission)
    await db.delete(rolePermission);

    // 3. Wipe permissions and non-admin roles created by previous tests
    await db.delete(permission);
    await db.delete(role).where(gt(role.id, 1)); // keep admin role (id: 1)

    // 4. Wipe users except the admin user used for authHeaders
    //    We use authHeaders.userId to ensure we don't invalidate the session.
    await db.delete(user).where(ne(user.id, authHeaders.userId));

    // 5. Re-seed admin's rbac:manage permission (wiped above)
    await seedAdminPermissions();
  });

  afterEach(async () => {
    // Same cleanup as beforeEach — ensures a crashed test doesn't leave
    // dirty state that bleeds into the NEXT test file's beforeAll.
    await db.delete(projectOwner);
    await db.delete(rolePermission);
    await db.delete(permission);
    await db.delete(role).where(gt(role.id, 1));
    await db.delete(user).where(ne(user.id, authHeaders.userId));
  });

  // ─── POST / ─────────────────────────────────────────────────────────────────

  it("should allow an Admin to register a project owner for another user", async () => {
    // 1. Grant admin the project_owners:manage permission
    const [perm] = await db
      .insert(permission)
      .values({ resource: "project_owners", action: "manage" })
      .returning();

    await db
      .insert(rolePermission)
      .values({ roleId: 1, permissionId: perm.id })
      .onConflictDoNothing();

    // 2. Seed a target user directly (no endpoint yet)
    const targetUserId = "user-target-001";
    await db
      .insert(user)
      .values({ id: targetUserId, email: "target@test.io", name: "Target User", firstName: "Target", lastName: "User" })
      .onConflictDoNothing();

    // 3. Admin calls the API
    const res = await request(app)
      .post(BASE)
      .set("Cookie", authHeaders.Cookie)
      .send({
        userId: targetUserId,
        bankDetails: {
          bankName:      "Test Bank",
          accountNumber: "123456",
          accountName:   "Target User",
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.userId).toBe(targetUserId);
    // onboardedBy should be the admin's ID, not the target user's ID
    expect(res.body.data.onboardedBy).not.toBe(targetUserId);
  });

  it("should allow a user to register themselves", async () => {
    // 1. Create project_owner role and its create_self permission
    const [poRole] = await db
      .insert(role)
      .values({ name: "project_owner", description: "Project Owner" })
      .returning();

    const [perm] = await db
      .insert(permission)
      .values({ resource: "project_owners", action: "create_self" })
      .returning();

    await db
      .insert(rolePermission)
      .values({ roleId: poRole.id, permissionId: perm.id })
      .onConflictDoNothing();

    // 2. Sign in as a user with the project_owner role
    //    getAuthHeaders now returns { Cookie, userId }
    const selfHeaders = await getAuthHeaders(poRole.id, {
      email:     "self@test.io",
      firstName: "Self",
      lastName:  "User",
    });

    // 3. User registers themselves — userId in body must match their own ID
    const res = await request(app)
      .post(BASE)
      .set("Cookie", selfHeaders.Cookie)
      .send({
        userId: selfHeaders.userId,   // ← was selfHeaders.user.id (bug fix)
        bankDetails: {
          bankName:      "My Bank",
          accountNumber: "987654",
          accountName:   "Self User",
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.userId).toBe(selfHeaders.userId);
    // Self-registered → onboardedBy should equal their own userId
    expect(res.body.data.onboardedBy).toBe(selfHeaders.userId);
  });

  it("should reject if a user tries to register someone else", async () => {
    // 1. Create project_owner role with create_self permission only
    const [poRole] = await db
      .insert(role)
      .values({ name: "project_owner", description: "Project Owner" })
      .returning();

    const [perm] = await db
      .insert(permission)
      .values({ resource: "project_owners", action: "create_self" })
      .returning();

    await db
      .insert(rolePermission)
      .values({ roleId: poRole.id, permissionId: perm.id })
      .onConflictDoNothing();

    // 2. Sign in as userA (project_owner role — has create_self, NOT manage)
    const userA = await getAuthHeaders(poRole.id, {
      email:     "userA@test.io",
      firstName: "User",
      lastName:  "A",
    });

    // 3. userA tries to register a different userId → must be 403
    const res = await request(app)
      .post(BASE)
      .set("Cookie", userA.Cookie)
      .send({
        userId: "some-other-user-id",   // not userA.userId
        bankDetails: {
          bankName:      "X",
          accountNumber: "Y",
          accountName:   "Z",
        },
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it("should return 409 if a project owner profile already exists for the user", async () => {
    // 1. Grant admin project_owners:manage
    const [perm] = await db
      .insert(permission)
      .values({ resource: "project_owners", action: "manage" })
      .returning();

    await db
      .insert(rolePermission)
      .values({ roleId: 1, permissionId: perm.id })
      .onConflictDoNothing();

    const targetUserId = "user-duplicate-001";
    await db
      .insert(user)
      .values({ id: targetUserId, email: "dup@test.io", name: "Dup User", firstName: "Dup", lastName: "User" })
      .onConflictDoNothing();

    const payload = {
      userId:      targetUserId,
      bankDetails: { bankName: "Bank", accountNumber: "111", accountName: "Dup" },
    };

    // First creation
    const first = await request(app)
      .post(BASE)
      .set("Cookie", authHeaders.Cookie)
      .send(payload);
    expect(first.status).toBe(201);

    // Second creation for the same userId
    const res = await request(app)
      .post(BASE)
      .set("Cookie", authHeaders.Cookie)
      .send(payload);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it("should return 401 when not authenticated", async () => {
    const res = await request(app)
      .post(BASE)
      .send({ userId: "anyone", bankDetails: { bankName: "X", accountNumber: "Y", accountName: "Z" } });

    expect(res.status).toBe(401);
  });

  // ─── GET / ──────────────────────────────────────────────────────────────────

  it("should allow an Admin to list project owners with cursor pagination", async () => {
    // 1. Grant manage permission
    const [perm] = await db
      .insert(permission)
      .values({ resource: "project_owners", action: "manage" })
      .returning();
    await db
      .insert(rolePermission)
      .values({ roleId: 1, permissionId: perm.id });

    // 2. Seed 3 project owners
    // Using simple IDs since projectOwner.id is UUID
    const poIds: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const uid = `user-list-${i}`;
      await db.insert(user).values({ id: uid, email: `list${i}@test.io`, firstName: "L", lastName: "N" });
      const [po] = await db.insert(projectOwner).values({
        userId: uid,
        code: `PO-LIST-${i}`,
        onboardedBy: authHeaders.userId,
      }).returning();
      poIds.push(po.id);
    }
    
    // Sort poIds to know the order (asc by UUID string)
    poIds.sort();

    // 3. Fetch first page (limit 2)
    const res1 = await request(app)
      .get(BASE)
      .query({ limit: 2 })
      .set("Cookie", authHeaders.Cookie);

    expect(res1.status).toBe(200);
    expect(res1.body.data.length).toBe(2);
    expect(res1.body.nextCursor).toBe(poIds[1]);

    // 4. Fetch second page
    const res2 = await request(app)
      .get(BASE)
      .query({ limit: 2, cursor: res1.body.nextCursor })
      .set("Cookie", authHeaders.Cookie);

    expect(res2.status).toBe(200);
    expect(res2.body.data.length).toBe(1);
    expect(res2.body.data[0].id).toBe(poIds[2]);
    expect(res2.body.nextCursor).toBeNull();
  });

  // ─── GET /:id ───────────────────────────────────────────────────────────────

  it("should fetch a single project owner profile by userId", async () => {
    const uid = "user-get-001";
    await db.insert(user).values({ id: uid, email: "get@test.io", firstName: "G", lastName: "U" });
    await db.insert(projectOwner).values({ userId: uid, code: "PO-GET-001", onboardedBy: uid });

    const res = await request(app)
      .get(`${BASE}/${uid}`)
      .set("Cookie", authHeaders.Cookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.userId).toBe(uid);
  });

  it("should return 404 if project owner profile does not exist", async () => {
    const res = await request(app)
      .get(`${BASE}/non-existent-user`)
      .set("Cookie", authHeaders.Cookie);

    expect(res.status).toBe(404);
  });

  // ─── PUT /:id ───────────────────────────────────────────────────────────────

  it("should allow a user to update their own payment details", async () => {
    // 1. Setup role/perm
    const [poRole] = await db.insert(role).values({ name: "po_edit", description: "PO Edit" }).returning();
    const [perm] = await db.insert(permission).values({ resource: "project_owners", action: "edit_self" }).returning();
    await db
      .insert(rolePermission)
      .values({ roleId: poRole.id, permissionId: perm.id });

    const self = await getAuthHeaders(poRole.id, { email: "edit@test.io" });
    
    // Seed profile
    await db.insert(projectOwner).values({ 
      userId: self.userId, 
      code: "PO-EDIT-001", 
      onboardedBy: self.userId,
      bankDetails: { bankName: "Old Bank", accountNumber: "000", accountName: "Old" }
    });

    // 2. Update
    const res = await request(app)
      .put(`${BASE}/${self.userId}`)
      .set("Cookie", self.Cookie)
      .send({
        bankDetails: { bankName: "New Bank", accountNumber: "111", accountName: "New" }
      });

    expect(res.status).toBe(200);
    expect(res.body.data.bankDetails.bankName).toBe("New Bank");
  });

  it("should reject if a user tries to update someone else's profile", async () => {
    // 1. Setup poRole with edit_self
    const [poRole] = await db.insert(role).values({ name: "po_edit_other", description: "PO Edit Other" }).returning();
    const [perm] = await db.insert(permission).values({ resource: "project_owners", action: "edit_self" }).returning();
    await db
      .insert(rolePermission)
      .values({ roleId: poRole.id, permissionId: perm.id });

    const userA = await getAuthHeaders(poRole.id, { email: "userA-edit@test.io" });
    
    // Seed profile for userB
    const userBId = "userB-id";
    await db.insert(user).values({ id: userBId, email: "userB-edit@test.io", firstName: "B", lastName: "U" });
    await db.insert(projectOwner).values({ userId: userBId, code: "PO-B-001", onboardedBy: userBId });

    // 2. userA tries to update userB
    const res = await request(app)
      .put(`${BASE}/${userBId}`)
      .set("Cookie", userA.Cookie)
      .send({
        bankDetails: { bankName: "Hacked Bank", accountNumber: "666", accountName: "Hacker" }
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  // ─── DELETE /:id ────────────────────────────────────────────────────────────

  it("should allow an Admin to delete a project owner profile", async () => {
    // 1. Grant manage permission
    const [perm] = await db.insert(permission).values({ resource: "project_owners", action: "manage" }).returning();
    await db
      .insert(rolePermission)
      .values({ roleId: 1, permissionId: perm.id });

    const uid = "user-del-001";
    await db.insert(user).values({ id: uid, email: "del@test.io", firstName: "D", lastName: "U" });
    await db.insert(projectOwner).values({ userId: uid, code: "PO-DEL-001", onboardedBy: uid });

    const res = await request(app)
      .delete(`${BASE}/${uid}`)
      .set("Cookie", authHeaders.Cookie);

    expect(res.status).toBe(204);

    // Verify deletion
    const check = await db.select().from(projectOwner).where(eq(projectOwner.userId, uid));
    expect(check.length).toBe(0);
  });
});
