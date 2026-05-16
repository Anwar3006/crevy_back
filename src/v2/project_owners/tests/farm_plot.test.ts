// src/v2/project_owners/tests/farm_plot.test.ts
import settings from "@/config/settings";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app from "@/index";
import { authHeaders, seedAdminPermissions } from "@/tests/setup";
import { getAuthHeaders } from "@/tests/helper";
import { db } from "@/config/db";
import { farmPlot, permission, projectOwner, role, rolePermission, user } from "@/v2/parent-model";
import { and, eq, gt, ne } from "drizzle-orm";

const BASE = `/api/${settings.API_VERSION}/farm-plots`;

describe("Farm Plot Module", () => {

  beforeEach(async () => {
    await db.delete(farmPlot);
    await db.delete(projectOwner);
    await db.delete(rolePermission);
    await db.delete(permission);
    await db.delete(role).where(gt(role.id, 1));
    await db.delete(user).where(ne(user.id, authHeaders.userId));
    await seedAdminPermissions();
  });

  afterEach(async () => {
    await db.delete(farmPlot);
    await db.delete(projectOwner);
    await db.delete(rolePermission);
    await db.delete(permission);
    await db.delete(role).where(gt(role.id, 1));
    await db.delete(user).where(ne(user.id, authHeaders.userId));
  });

  // ─── POST / ─────────────────────────────────────────────────────────────────

  it("should allow the assigned Admin to create a farm plot", async () => {
    // 1. Create a Project Owner registered by the session admin (authHeaders.userId)
    const poUserId = "po-user-001";
    await db.insert(user).values({ id: poUserId, email: "po@test.io", firstName: "P", lastName: "O" });
    const [po] = await db.insert(projectOwner).values({
      userId: poUserId,
      code: "PO-001",
      onboardedBy: authHeaders.userId,
    }).returning();

    // 2. Session admin creates plot
    const res = await request(app)
      .post(BASE)
      .set("Cookie", authHeaders.Cookie)
      .send({
        projectOwnerId: po.id,
        country: "Ghana",
        region: "Greater Accra",
        village: "Test Village",
        centroid: "POINT(-0.186964 5.603717)",
        areaHectares: 5.5,
      });

    if(res.status !== 201) console.error(res.body); expect(res.status).toBe(201);
    expect(res.body.data.country).toBe("Ghana");
  });

  it("should reject if a non-assigned admin tries to create a farm plot", async () => {
    // 1. Create a PO registered by "other-admin"
    const otherAdminId = "other-admin-id";
    await db.insert(user).values({ id: otherAdminId, email: "other@test.io", firstName: "O", lastName: "A", roleId: 1 }).onConflictDoNothing();
    
    const poUserId = "po-user-002";
    await db.insert(user).values({ id: poUserId, email: "po2@test.io", firstName: "P", lastName: "O" });
    const [po] = await db.insert(projectOwner).values({
      userId: poUserId,
      code: "PO-002",
      onboardedBy: otherAdminId,
    }).returning();

    // 2. Session admin (not assigned) tries to create plot
    const res = await request(app)
      .post(BASE)
      .set("Cookie", authHeaders.Cookie)
      .send({
        projectOwnerId: po.id,
        country: "Ghana",
        region: "Ashanti",
        centroid: "POINT(-0.186964 5.603717)",
        areaHectares: 2.0,
      });

    expect(res.status).toBe(403);
  });

  // ─── GET / ──────────────────────────────────────────────────────────────────

  it("should allow an admin with admin:view to list all farm plots with cursor pagination", async () => {
    // 1. Grant admin:view
    const [perm] = await db.insert(permission).values({ resource: "admin", action: "view" }).returning();
    await db.insert(rolePermission).values({ roleId: 1, permissionId: perm.id });

    // 2. Seed plots
    const poUserId = "po-user-list";
    await db.insert(user).values({ id: poUserId, email: "polist@test.io", firstName: "P", lastName: "O" });
    const [po] = await db.insert(projectOwner).values({ userId: poUserId, code: "PO-LIST", onboardedBy: authHeaders.userId }).returning();

    const plotIds: string[] = [];
    for (let i = 1; i <= 3; i++) {
        const [p] = await db.insert(farmPlot).values({
            projectOwnerId: po.id,
            country: "Ghana",
            region: `Region ${i}`,
            centroid: "POINT(0 0)",
            areaHectares: i.toString()
        }).returning();
        plotIds.push(p.id);
    }
    plotIds.sort();

    // 3. Fetch
    const res = await request(app)
      .get(BASE)
      .query({ limit: 2 })
      .set("Cookie", authHeaders.Cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.nextCursor).toBe(plotIds[1]);
  });

  // ─── GET /:id ───────────────────────────────────────────────────────────────

  it("should allow any authenticated user to fetch farm plot details", async () => {
    const poUserId = "po-user-get";
    await db.insert(user).values({ id: poUserId, email: "poget@test.io", firstName: "P", lastName: "O" });
    const [po] = await db.insert(projectOwner).values({ userId: poUserId, code: "PO-GET", onboardedBy: authHeaders.userId }).returning();
    const [plot] = await db.insert(farmPlot).values({
        projectOwnerId: po.id,
        country: "Ghana",
        region: "Volta",
        centroid: "POINT(1 1)",
        areaHectares: "10.0"
    }).returning();

    const res = await request(app)
      .get(`${BASE}/${plot.id}`)
      .set("Cookie", authHeaders.Cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.region).toBe("Volta");
  });

  // ─── PUT /:id ───────────────────────────────────────────────────────────────

  it("should allow the assigned Admin to update a farm plot", async () => {
    const poUserId = "po-user-put";
    await db.insert(user).values({ id: poUserId, email: "poput@test.io", firstName: "P", lastName: "O" });
    const [po] = await db.insert(projectOwner).values({ userId: poUserId, code: "PO-PUT", onboardedBy: authHeaders.userId }).returning();
    const [plot] = await db.insert(farmPlot).values({
        projectOwnerId: po.id,
        country: "Ghana",
        region: "Western",
        centroid: "POINT(2 2)",
        areaHectares: "15.0"
    }).returning();

    const res = await request(app)
      .put(`${BASE}/${plot.id}`)
      .set("Cookie", authHeaders.Cookie)
      .send({ village: "New Village" });

    expect(res.status).toBe(200);
    expect(res.body.data.village).toBe("New Village");
  });

  // ─── DELETE /:id ────────────────────────────────────────────────────────────

  it("should allow the assigned Admin to delete a farm plot", async () => {
    const poUserId = "po-user-del";
    await db.insert(user).values({ id: poUserId, email: "podel@test.io", firstName: "P", lastName: "O" });
    const [po] = await db.insert(projectOwner).values({ userId: poUserId, code: "PO-DEL", onboardedBy: authHeaders.userId }).returning();
    const [plot] = await db.insert(farmPlot).values({
        projectOwnerId: po.id,
        country: "Ghana",
        region: "Northern",
        centroid: "POINT(3 3)",
        areaHectares: "20.0"
    }).returning();

    const res = await request(app)
      .delete(`${BASE}/${plot.id}`)
      .set("Cookie", authHeaders.Cookie);

    if(res.status !== 204) console.error(res.body); expect(res.status).toBe(204);

    const check = await db.select().from(farmPlot).where(eq(farmPlot.id, plot.id));
    expect(check.length).toBe(0);
  });
});
