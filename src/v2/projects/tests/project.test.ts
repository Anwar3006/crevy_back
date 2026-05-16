// src/v2/projects/tests/project.test.ts
import settings from '@/config/settings';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '@/index';
import { authHeaders, seedAdminPermissions } from '@/tests/setup';
import { getAuthHeaders } from '@/tests/helper';
import { db } from '@/config/db';
import {
  currency,
  farmPlot,
  permission,
  project,
  projectActivity,
  projectOwner,
  projectOwnerEnrollment,
  projectPlot,
  projectDocument,
  role,
  rolePermission,
  user,
} from '@/v2/parent-model';
import { and, eq, gt, ne } from 'drizzle-orm';

const BASE = `/api/${settings.API_VERSION}/projects`;

describe('Projects Module', () => {

  // ── Shared fixtures ────────────────────────────────────────────────────────

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

  async function seedCurrency() {
    const [c] = await db
      .insert(currency)
      .values({ name: 'US Dollar', code: 'USD' })
      .onConflictDoNothing()
      .returning();
    
    if (!c) {
        const [existing] = await db.select().from(currency).where(eq(currency.code, 'USD'));
        return existing;
    }
    return c;
  }

  async function seedProjectOwner(userId: string, code: string) {
    await db
      .insert(user)
      .values({ id: userId, email: `${userId}@test.io`, firstName: 'P', lastName: 'O' })
      .onConflictDoNothing();

    const [po] = await db
      .insert(projectOwner)
      .values({ userId, code, onboardedBy: authHeaders.userId })
      .onConflictDoNothing()
      .returning();

    if (!po) {
        const [existing] = await db.select().from(projectOwner).where(eq(projectOwner.userId, userId));
        return existing;
    }
    return po;
  }

  async function seedFarmPlot(projectOwnerId: string, area: number) {
    const [plot] = await db
      .insert(farmPlot)
      .values({
        projectOwnerId,
        country:      'GH',
        region:       'Ashanti',
        centroid:     'POINT(-1.6244 6.6666)', // Kumasi
        areaHectares: area.toString(),
      })
      .returning();
    return plot;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  beforeEach(async () => {
    await db.delete(projectDocument);
    await db.delete(projectActivity);
    await db.delete(projectPlot);
    await db.delete(projectOwnerEnrollment);
    await db.delete(project);
    await db.delete(farmPlot);
    await db.delete(projectOwner);
    await db.delete(rolePermission);
    await db.delete(permission);
    await db.delete(role).where(gt(role.id, 1));
    await db.delete(user).where(ne(user.id, authHeaders.userId));
    await seedAdminPermissions();
  });

  // ── Project Creation ───────────────────────────────────────────────────────

  it('should allow an admin to create a new project with unique code generation', async () => {
    await grantAdminPermission('manage');
    const curr = await seedCurrency();

    const payload = {
      name:        'Ghana Reforestation 2026',
      projectType: 'regenerative_agriculture',
      sector:      'green_economy',
      region:      'Ashanti',
      country:     'GH',
      startDate:   '2026-01-01',
      currencyId:  curr.id,
    };

    const res = await request(app)
      .post(BASE)
      .set('Cookie', authHeaders.Cookie)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.code).toMatch(/^PRJ-GH-\d{4}-001$/);
    expect(res.body.data.projectStage).toBe('registration');
  });

  // ── Enrollments ────────────────────────────────────────────────────────────

  it('should prevent double enrollment of a project owner in the same project', async () => {
    await grantAdminPermission('manage');
    const curr = await seedCurrency();
    const po   = await seedProjectOwner('po-1', 'PO-CODE-1');

    const [prj] = await db.insert(project).values({
      code: 'PRJ-TEST-001',
      name: 'Test Project',
      projectType: 'regenerative_agriculture',
      sector: 'green_economy',
      region: 'R',
      country: 'GH',
      startDate: '2026-01-01',
      currencyId: curr.id,
      createdBy: authHeaders.userId,
    }).returning();

    const enrollPayload = {
      projectId: prj.id,
      projectOwnerId: po.id,
      joinedDate: '2026-02-01',
    };

    // First enrollment
    const res1 = await request(app)
      .post(`${BASE}/enrollments`)
      .set('Cookie', authHeaders.Cookie)
      .send(enrollPayload);
    expect(res1.status).toBe(201);

    // Duplicate enrollment
    const res2 = await request(app)
      .post(`${BASE}/enrollments`)
      .set('Cookie', authHeaders.Cookie)
      .send(enrollPayload);
    
    expect(res2.status).toBe(409);
    expect(res2.body.message).toContain('already enrolled');
  });

  // ── Plot Enrollment (CRITICAL) ─────────────────────────────────────────────

  it('should prevent enrolling more area than available in a land plot', async () => {
    await grantAdminPermission('manage');
    const curr = await seedCurrency();
    const po   = await seedProjectOwner('po-plot-1', 'PO-P1');
    const plot = await seedFarmPlot(po.id, 5.5); // 5.5 hectares

    const [prj] = await db.insert(project).values({
      code: 'PRJ-PLOT-001',
      name: 'Plot Project',
      projectType: 'regenerative_agriculture',
      sector: 'green_economy',
      region: 'R',
      country: 'GH',
      startDate: '2026-01-01',
      currencyId: curr.id,
      createdBy: authHeaders.userId,
    }).returning();

    const res = await request(app)
      .post(`${BASE}/plots`)
      .set('Cookie', authHeaders.Cookie)
      .send({
        projectId: prj.id,
        plotId: plot.id,
        enrolledAreaHectares: 6.0, // Over 5.5
        enrolledDate: '2026-02-01',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('exceeds total plot area');
  });

  it('should prevent double-enrolling a land plot in multiple projects (Double Counting Prevention)', async () => {
    await grantAdminPermission('manage');
    const curr = await seedCurrency();
    const po   = await seedProjectOwner('po-double', 'PO-D1');
    const plot = await seedFarmPlot(po.id, 10.0);

    const [prj1] = await db.insert(project).values({
      code: 'PRJ-1', name: 'P1', projectType: 'regenerative_agriculture', sector: 'green_economy', region: 'R', country: 'GH', startDate: '2026-01-01', currencyId: curr.id, createdBy: authHeaders.userId,
    }).returning();

    const [prj2] = await db.insert(project).values({
      code: 'PRJ-2', name: 'P2', projectType: 'regenerative_agriculture', sector: 'green_economy', region: 'R', country: 'GH', startDate: '2026-01-01', currencyId: curr.id, createdBy: authHeaders.userId,
    }).returning();

    // Enroll in PRJ1
    await request(app)
      .post(`${BASE}/plots`)
      .set('Cookie', authHeaders.Cookie)
      .send({
        projectId: prj1.id,
        plotId: plot.id,
        enrolledAreaHectares: 5.0,
        enrolledDate: '2026-02-01',
      });

    // Try to enroll in PRJ2
    const res = await request(app)
      .post(`${BASE}/plots`)
      .set('Cookie', authHeaders.Cookie)
      .send({
        projectId: prj2.id,
        plotId: plot.id,
        enrolledAreaHectares: 5.0,
        enrolledDate: '2026-03-01',
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('already enrolled in another active project');
  });

  // ── Activities ─────────────────────────────────────────────────────────────

  it('should allow an admin to track operational milestones (activities)', async () => {
    await grantAdminPermission('manage');
    const curr = await seedCurrency();
    const [prj] = await db.insert(project).values({
      code: 'PRJ-ACT', name: 'A', projectType: 'blue_carbon', region: 'R', country: 'GH', startDate: '2026-01-01', currencyId: curr.id, createdBy: authHeaders.userId,
    }).returning();

    const res = await request(app)
      .post(`${BASE}/activities`)
      .set('Cookie', authHeaders.Cookie)
      .send({
        projectId: prj.id,
        name: 'Soil Sampling',
        activityDate: '2026-02-15',
        activityDescription: 'Baseline soil carbon measurement',
        activityStatus: 'completed',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.activityStatus).toBe('completed');
  });

  // ── RBAC ───────────────────────────────────────────────────────────────────

  it('should return 403 when a field agent tries to create a project', async () => {
    // Agent role with only assign permission
    const [agentRole] = await db.insert(role).values({ name: 'agent', description: 'Agent' }).returning();
    const [perm] = await db.insert(permission).values({ resource: 'project_owners', action: 'assign' }).returning();
    await db.insert(rolePermission).values({ roleId: agentRole.id, permissionId: perm.id });

    const agent = await getAuthHeaders(agentRole.id, { email: 'agent@test.io' });
    const curr  = await seedCurrency();

    const res = await request(app)
      .post(BASE)
      .set('Cookie', agent.Cookie)
      .send({
        name: 'Agent Project',
        projectType: 'regenerative_agriculture',
        sector: 'green_economy',
        region: 'R',
        country: 'GH',
        startDate: '2026-01-01',
        currencyId: curr.id,
      });

    expect(res.status).toBe(403);
  });

  // ── Documents ──────────────────────────────────────────────────────────────

  it('should allow uploading and verifying a project document', async () => {
    await grantAdminPermission('manage');
    // Also grant permission for document verification
    const [docPerm] = await db.insert(permission).values({ resource: 'project_documents', action: 'manage' }).returning();
    await db.insert(rolePermission).values({ roleId: 1, permissionId: docPerm.id }).onConflictDoNothing();

    const curr = await seedCurrency();
    const [prj] = await db.insert(project).values({
      code: 'PRJ-DOC', name: 'D', projectType: 'regenerative_agriculture', sector: 'green_economy', region: 'R', country: 'GH', startDate: '2026-01-01', currencyId: curr.id, createdBy: authHeaders.userId,
    }).returning();

    // 1. Upload
    const uploadRes = await request(app)
      .post(`${BASE}/${prj.id}/documents`)
      .set('Cookie', authHeaders.Cookie)
      .send({
        documentType: 'land_ownership',
        fileName:     'title_deed.pdf',
        fileUrl:      'https://storage.crevy.io/docs/title_deed.pdf',
        fileSize:     1024 * 1024,
        mimeType:     'application/pdf',
      });

    expect(uploadRes.status).toBe(201);
    const docId = uploadRes.body.data.id;

    // 2. Verify (PATCH)
    const verifyRes = await request(app)
      .patch(`${BASE}/${prj.id}/documents/${docId}/verify`)
      .set('Cookie', authHeaders.Cookie)
      .send();

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.isVerified).toBe(true);
    expect(verifyRes.body.data.verifiedBy).toBe(authHeaders.userId);

    // 3. List
    const listRes = await request(app)
      .get(`${BASE}/${prj.id}/documents`)
      .set('Cookie', authHeaders.Cookie);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBe(1);
    expect(listRes.body.data[0].fileName).toBe('title_deed.pdf');

    // 4. Delete
    const delRes = await request(app)
      .delete(`${BASE}/${prj.id}/documents/${docId}`)
      .set('Cookie', authHeaders.Cookie);

    expect(delRes.status).toBe(200);
  });
});
