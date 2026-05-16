// src/v2/project_owners/tests/project_owner_assignment.test.ts
import settings from '@/config/settings';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '@/index';
import { authHeaders, seedAdminPermissions } from '@/tests/setup';
import { getAuthHeaders } from '@/tests/helper';
import { db } from '@/config/db';
import {
  partner,
  permission,
  projectOwner,
  projectOwnerAssignment,
  role,
  rolePermission,
  user,
} from '@/v2/parent-model';
import { eq, gt, ne } from 'drizzle-orm';

const BASE = `/api/${settings.API_VERSION}/project-owner-assignments`;

/**
 * ─── TEST ISOLATION STRATEGY ─────────────────────────────────────────────────
 *
 * beforeEach:
 *   1. Wipe projectOwnerAssignment rows (FK → projectOwner)
 *   2. Wipe projectOwner rows
 *   3. Wipe bridge table (FK → role + permission)
 *   4. Wipe permissions & non-admin roles
 *   5. Wipe users except the test-session admin
 *   6. Re-seed admin's rbac:manage permission
 *
 * Each test seeds exactly the roles / permissions it needs.
 * ─────────────────────────────────────────────────────────────────────────────
 */

describe('Project Owner Assignment Module', () => {

  // ── Shared fixtures ────────────────────────────────────────────────────────

  /** Insert a project owner whose onboardedBy = authHeaders.userId */
  async function seedProjectOwner(userId: string, code: string) {
    await db
      .insert(user)
      .values({ id: userId, email: `${userId}@test.io`, firstName: 'P', lastName: 'O' })
      .onConflictDoNothing();

    const [po] = await db
      .insert(projectOwner)
      .values({ userId, code, onboardedBy: authHeaders.userId })
      .returning();

    return po;
  }

  /** Grant the admin session user a named permission on project_owners */
  async function grantAdminPermission(action: string) {
    const [perm] = await db
      .insert(permission)
      .values({ resource: 'project_owners', action })
      .returning();

    await db
      .insert(rolePermission)
      .values({ roleId: 1, permissionId: perm.id })
      .onConflictDoNothing();

    return perm;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  beforeEach(async () => {
    await db.delete(projectOwnerAssignment);
    await db.delete(projectOwner);
    await db.delete(rolePermission);
    await db.delete(permission);
    await db.delete(role).where(gt(role.id, 1));
    await db.delete(user).where(ne(user.id, authHeaders.userId));
    await seedAdminPermissions();
  });

  afterEach(async () => {
    await db.delete(projectOwnerAssignment);
    await db.delete(projectOwner);
    await db.delete(rolePermission);
    await db.delete(permission);
    await db.delete(role).where(gt(role.id, 1));
    await db.delete(user).where(ne(user.id, authHeaders.userId));
  });

  // ── POST / ─────────────────────────────────────────────────────────────────

  it('should allow an admin (project_owners:manage) to create a B2C primary assignment', async () => {
    //B2C = Crevy(we) onboarded the project owner ourselves
    await grantAdminPermission('manage');
    const po = await seedProjectOwner('po-create-001', 'PO-C-001');

    const res = await request(app)
      .post(BASE)
      .set('Cookie', authHeaders.Cookie)
      .send({
        projectOwnerId:  po.id,
        agentId:         authHeaders.userId,
        assignmentType:  'primary',
        isB2cAssignment: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.projectOwnerId).toBe(po.id);
    expect(res.body.data.assignmentType).toBe('primary');
    expect(res.body.data.isB2cAssignment).toBe(true);
    expect(res.body.data.assignedBy).toBe(authHeaders.userId);
  });

  it('should allow an admin (project_owners:manage) to create a B2B secondary assignment', async () => {
    // B2B = Partner brought the PO. Admin assigns another Admin (or themselves) + PartnerId.
    await grantAdminPermission('manage');
    const po = await seedProjectOwner('po-b2b-ok', 'PO-B2B-OK');

    const [partnerRow] = await db
      .insert(partner)
      .values({
        name:          'B2B Partner',
        partnerType:   'channel',
        contactPerson: 'Partner Contact',
        contactEmail:  'b2b@test.io',
        country:       'GH',
      })
      .returning();

    const res = await request(app)
      .post(BASE)
      .set('Cookie', authHeaders.Cookie)
      .send({
        projectOwnerId:  po.id,
        agentId:         authHeaders.userId, // Admin assigning themselves
        assignmentType:  'secondary',
        isB2cAssignment: false,
        partnerId:       partnerRow.id,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.isB2cAssignment).toBe(false);
    expect(res.body.data.partnerId).toBe(partnerRow.id);
  });

  it('should return 403 when a field agent (project_owners:assign) tries to create a B2B assignment', async () => {
    // Create agent role + assign permission
    const [agentRole] = await db
      .insert(role)
      .values({ name: 'field_agent_b2b', description: 'Field Agent' })
      .returning();

    const [perm] = await db
      .insert(permission)
      .values({ resource: 'project_owners', action: 'assign' })
      .returning();

    await db
      .insert(rolePermission)
      .values({ roleId: agentRole.id, permissionId: perm.id })
      .onConflictDoNothing();

    const agent = await getAuthHeaders(agentRole.id, { email: 'agent-b2b@test.io' });
    const po    = await seedProjectOwner('po-b2b-fail', 'PO-B2B-FAIL');

    const res = await request(app)
      .post(BASE)
      .set('Cookie', agent.Cookie)
      .send({
        projectOwnerId:  po.id,
        agentId:         agent.userId,
        assignmentType:  'secondary',
        isB2cAssignment: false,
        partnerId:       1,
      });

    expect(res.status).toBe(403);
  });

  it('should return 400 when a B2C assignment includes a partnerId', async () => {
    await grantAdminPermission('manage');
    const po = await seedProjectOwner('po-b2c-bad', 'PO-B2C-BAD');

    const res = await request(app)
      .post(BASE)
      .set('Cookie', authHeaders.Cookie)
      .send({
        projectOwnerId:  po.id,
        agentId:         authHeaders.userId,
        assignmentType:  'primary',
        isB2cAssignment: true,
        partnerId:       999,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should return 400 when a B2B assignment is missing a partnerId', async () => {
    await grantAdminPermission('manage');
    const po = await seedProjectOwner('po-b2b-bad', 'PO-B2B-BAD');

    const res = await request(app)
      .post(BASE)
      .set('Cookie', authHeaders.Cookie)
      .send({
        projectOwnerId:  po.id,
        agentId:         authHeaders.userId,
        assignmentType:  'primary',
        isB2cAssignment: false,
        // no partnerId
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should return 409 when a second active primary assignment is created for the same project owner', async () => {
    await grantAdminPermission('manage');
    const po = await seedProjectOwner('po-conflict', 'PO-CONFLICT');

    const payload = {
      projectOwnerId:  po.id,
      agentId:         authHeaders.userId,
      assignmentType:  'primary',
      isB2cAssignment: true,
    };

    const first = await request(app)
      .post(BASE)
      .set('Cookie', authHeaders.Cookie)
      .send(payload);

    expect(first.status).toBe(201);

    const second = await request(app)
      .post(BASE)
      .set('Cookie', authHeaders.Cookie)
      .send(payload);

    expect(second.status).toBe(409);
    expect(second.body.success).toBe(false);
  });

  it('should return 401 when unauthenticated', async () => {
    const res = await request(app).post(BASE).send({});
    expect(res.status).toBe(401);
  });

  it('should return 403 when a user without assign or manage permission tries to create', async () => {
    // Regular role with no assignment permission
    const [plainRole] = await db
      .insert(role)
      .values({ name: 'plain_user', description: 'Plain User' })
      .returning();

    const plain = await getAuthHeaders(plainRole.id, { email: 'plain@test.io' });
    const po    = await seedProjectOwner('po-403', 'PO-403');

    const res = await request(app)
      .post(BASE)
      .set('Cookie', plain.Cookie)
      .send({
        projectOwnerId:  po.id,
        agentId:         plain.userId,
        assignmentType:  'secondary',
        isB2cAssignment: true,
      });

    expect(res.status).toBe(403);
  });

  // ── GET / ──────────────────────────────────────────────────────────────────

  it('should allow an admin to list assignments with cursor pagination', async () => {
    await grantAdminPermission('manage');
    const po = await seedProjectOwner('po-list', 'PO-LIST');

    // Seed 3 assignments
    const ids: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const [a] = await db
        .insert(projectOwnerAssignment)
        .values({
          projectOwnerId:  po.id,
          agentId:         authHeaders.userId,
          assignedBy:      authHeaders.userId,
          assignmentType:  'secondary',
          isB2cAssignment: true,
        })
        .returning();
      ids.push(a.id);
    }
    ids.sort();

    const res1 = await request(app)
      .get(BASE)
      .query({ limit: 2 })
      .set('Cookie', authHeaders.Cookie);

    expect(res1.status).toBe(200);
    expect(res1.body.data.length).toBe(2);
    expect(res1.body.nextCursor).toBe(ids[1]);

    const res2 = await request(app)
      .get(BASE)
      .query({ limit: 2, cursor: res1.body.nextCursor })
      .set('Cookie', authHeaders.Cookie);

    expect(res2.status).toBe(200);
    expect(res2.body.data.length).toBe(1);
    expect(res2.body.data[0].id).toBe(ids[2]);
    expect(res2.body.nextCursor).toBeNull();
  });

  it('should filter list by projectOwnerId', async () => {
    await grantAdminPermission('manage');
    const po1 = await seedProjectOwner('po-filter-1', 'PO-F1');
    const po2 = await seedProjectOwner('po-filter-2', 'PO-F2');

    await db.insert(projectOwnerAssignment).values({
      projectOwnerId:  po1.id,
      agentId:         authHeaders.userId,
      assignedBy:      authHeaders.userId,
      assignmentType:  'primary',
      isB2cAssignment: true,
    });
    await db.insert(projectOwnerAssignment).values({
      projectOwnerId:  po2.id,
      agentId:         authHeaders.userId,
      assignedBy:      authHeaders.userId,
      assignmentType:  'secondary',
      isB2cAssignment: true,
    });

    const res = await request(app)
      .get(BASE)
      .query({ projectOwnerId: po1.id })
      .set('Cookie', authHeaders.Cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].projectOwnerId).toBe(po1.id);
  });

  it('should return 403 when a non-admin tries to list all assignments', async () => {
    const [plainRole] = await db
      .insert(role)
      .values({ name: 'plain_list', description: 'Plain' })
      .returning();

    const plain = await getAuthHeaders(plainRole.id, { email: 'plain-list@test.io' });

    const res = await request(app)
      .get(BASE)
      .set('Cookie', plain.Cookie);

    expect(res.status).toBe(403);
  });

  // ── GET /:id ───────────────────────────────────────────────────────────────

  it('should allow any authenticated user to fetch a single assignment by id', async () => {
    const po = await seedProjectOwner('po-get', 'PO-GET');

    const [a] = await db
      .insert(projectOwnerAssignment)
      .values({
        projectOwnerId:  po.id,
        agentId:         authHeaders.userId,
        assignedBy:      authHeaders.userId,
        assignmentType:  'primary',
        isB2cAssignment: true,
      })
      .returning();

    const res = await request(app)
      .get(`${BASE}/${a.id}`)
      .set('Cookie', authHeaders.Cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(a.id);
    expect(res.body.data.isActive).toBe(true);
  });

  it('should return 404 for a non-existent assignment id', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res    = await request(app)
      .get(`${BASE}/${fakeId}`)
      .set('Cookie', authHeaders.Cookie);

    expect(res.status).toBe(404);
  });

  // ── PUT /:id ───────────────────────────────────────────────────────────────

  it('should allow an admin to update any assignment', async () => {
    await grantAdminPermission('manage');
    const po = await seedProjectOwner('po-put', 'PO-PUT');

    const [a] = await db
      .insert(projectOwnerAssignment)
      .values({
        projectOwnerId:  po.id,
        agentId:         authHeaders.userId,
        assignedBy:      authHeaders.userId,
        assignmentType:  'secondary',
        isB2cAssignment: true,
      })
      .returning();

    const res = await request(app)
      .put(`${BASE}/${a.id}`)
      .set('Cookie', authHeaders.Cookie)
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);
  });

  it('should allow the assigned agent to update their own assignment', async () => {
    // Create agent role + assign permission
    const [agentRole] = await db
      .insert(role)
      .values({ name: 'agent_put', description: 'Agent Put' })
      .returning();

    const [perm] = await db
      .insert(permission)
      .values({ resource: 'project_owners', action: 'assign' })
      .returning();

    await db
      .insert(rolePermission)
      .values({ roleId: agentRole.id, permissionId: perm.id })
      .onConflictDoNothing();

    const agent = await getAuthHeaders(agentRole.id, { email: 'agent-put@test.io', firstName: 'Agent', lastName: 'Put' });
    const po    = await seedProjectOwner('po-agent-put', 'PO-AP');

    const [a] = await db
      .insert(projectOwnerAssignment)
      .values({
        projectOwnerId:  po.id,
        agentId:         agent.userId,   // ← agent is the owner of this assignment
        assignedBy:      authHeaders.userId,
        assignmentType:  'secondary',
        isB2cAssignment: true,
      })
      .returning();

    const res = await request(app)
      .put(`${BASE}/${a.id}`)
      .set('Cookie', agent.Cookie)
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);
  });

  it('should return 403 when a non-admin and non-agent user tries to update an assignment', async () => {
    const [plainRole] = await db
      .insert(role)
      .values({ name: 'plain_put', description: 'Plain Put' })
      .returning();

    const plain = await getAuthHeaders(plainRole.id, { email: 'plain-put@test.io' });
    const po    = await seedProjectOwner('po-403-put', 'PO-403-PUT');

    const [a] = await db
      .insert(projectOwnerAssignment)
      .values({
        projectOwnerId:  po.id,
        agentId:         authHeaders.userId,
        assignedBy:      authHeaders.userId,
        assignmentType:  'secondary',
        isB2cAssignment: true,
      })
      .returning();

    const res = await request(app)
      .put(`${BASE}/${a.id}`)
      .set('Cookie', plain.Cookie)
      .send({ isActive: false });

    expect(res.status).toBe(403);
  });

  it('should return 409 when updating an assignment type to primary when another active primary already exists', async () => {
    await grantAdminPermission('manage');
    const po = await seedProjectOwner('po-conflict-put', 'PO-CP');

    // Active primary already exists
    await db.insert(projectOwnerAssignment).values({
      projectOwnerId:  po.id,
      agentId:         authHeaders.userId,
      assignedBy:      authHeaders.userId,
      assignmentType:  'primary',
      isB2cAssignment: true,
    });

    // A secondary we want to promote
    const [secondary] = await db
      .insert(projectOwnerAssignment)
      .values({
        projectOwnerId:  po.id,
        agentId:         authHeaders.userId,
        assignedBy:      authHeaders.userId,
        assignmentType:  'secondary',
        isB2cAssignment: true,
      })
      .returning();

    const res = await request(app)
      .put(`${BASE}/${secondary.id}`)
      .set('Cookie', authHeaders.Cookie)
      .send({ assignmentType: 'primary' });

    expect(res.status).toBe(409);
  });

  // ── DELETE /:id ────────────────────────────────────────────────────────────

  it('should allow an admin to hard-delete an assignment', async () => {
    await grantAdminPermission('manage');
    const po = await seedProjectOwner('po-del', 'PO-DEL');

    const [a] = await db
      .insert(projectOwnerAssignment)
      .values({
        projectOwnerId:  po.id,
        agentId:         authHeaders.userId,
        assignedBy:      authHeaders.userId,
        assignmentType:  'primary',
        isB2cAssignment: true,
      })
      .returning();

    const res = await request(app)
      .delete(`${BASE}/${a.id}`)
      .set('Cookie', authHeaders.Cookie);

    expect(res.status).toBe(204);

    const check = await db
      .select()
      .from(projectOwnerAssignment)
      .where(eq(projectOwnerAssignment.id, a.id));

    expect(check.length).toBe(0);
  });

  it('should return 404 when deleting a non-existent assignment', async () => {
    await grantAdminPermission('manage');
    const fakeId = '00000000-0000-0000-0000-000000000001';

    const res = await request(app)
      .delete(`${BASE}/${fakeId}`)
      .set('Cookie', authHeaders.Cookie);

    expect(res.status).toBe(404);
  });

  it('should return 403 when a non-admin tries to delete an assignment', async () => {
    const [plainRole] = await db
      .insert(role)
      .values({ name: 'plain_del', description: 'Plain Del' })
      .returning();

    const plain = await getAuthHeaders(plainRole.id, { email: 'plain-del@test.io' });
    const po    = await seedProjectOwner('po-del-403', 'PO-DEL-403');

    const [a] = await db
      .insert(projectOwnerAssignment)
      .values({
        projectOwnerId:  po.id,
        agentId:         authHeaders.userId,
        assignedBy:      authHeaders.userId,
        assignmentType:  'secondary',
        isB2cAssignment: true,
      })
      .returning();

    const res = await request(app)
      .delete(`${BASE}/${a.id}`)
      .set('Cookie', plain.Cookie);

    expect(res.status).toBe(403);
  });
});
