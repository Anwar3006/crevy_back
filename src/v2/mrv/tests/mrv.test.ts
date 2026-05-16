// src/v2/mrv/tests/mrv.test.ts
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app from "@/index";
import settings from "@/config/settings";
import { db } from "@/config/db";
import { sql } from "drizzle-orm";
import {
  carbonCredit,
  currency,
  farmPlot,
  mrvBlockchainAnchor,
  mrvIngestionEvent,
  mrvVerificationResult,
  partner,
  permission,
  project,
  projectOwner,
  role,
  rolePermission,
  user,
} from "@/v2/parent-model";
import { authHeaders, seedAdminPermissions } from "@/tests/setup";
import { uuidv7 } from "uuidv7";
import { eq, gt } from "drizzle-orm";

const BASE = `/api/${settings.API_VERSION}/mrv`;
const CC_SECRET = process.env.CC_WEBHOOK_SECRET!;

/**
 * ─── FIXTURE IDs ──────────────────────────────────────────────────────────────
 * All IDs are fixed so tests can reference them without querying the DB.
 * We use uuidv7() once at module load time — they are stable for the life
 * of the test run.
 */
const IDS = {
  currency:     0 as number,    // serial — filled in beforeAll
  partner:      0 as number,    // serial — filled in beforeAll
  project:      uuidv7(),
  projectOwner: uuidv7(),
  farmPlot:     uuidv7(),
  userId:       `test-mrv-user-${Date.now()}`,
};

// ─── Fixture helpers ─────────────────────────────────────────────────────────

const createBaseFixtures = async () => {
  // 1. Currency
  const [cur] = await db
    .insert(currency)
    .values({ code: "MRV", name: "MRV Test Currency" })
    .onConflictDoUpdate({ target: currency.code, set: { name: "MRV Test Currency" } })
    .returning();
  IDS.currency = cur.id;

  // 2. User (direct insert — bypasses better-auth for fixture purposes)
  await db
    .insert(user)
    .values({
      id:            IDS.userId,
      email:         `mrv-fixture@crevy-test.io`,
      name:          "MRV Fixture User",
      firstName:     "MRV",
      lastName:      "Fixture",
      emailVerified: false,
    })
    .onConflictDoNothing();

  // 3. ProjectOwner
  await db
    .insert(projectOwner)
    .values({
      id:                 IDS.projectOwner,
      userId:             IDS.userId,
      code:               "PO-GH-999001",
      verificationStatus: "verified",
      onboardedBy:        IDS.userId,
    })
    .onConflictDoNothing();

  // 4. Partner (approved — required for dMRV submission)
  const [part] = await db
    .insert(partner)
    .values({
      name:                   "CraftedClimate Test",
      partnerType:            "dMRV_provider",
      contactPerson:          "CC API",
      contactEmail:           "api@craftedclimate-test.com",
      status:                 "approved",
      hasDataSharingAgreement: true,
    })
    .onConflictDoUpdate({
      target: partner.name,
      set:    { status: "approved" },
    })
    .returning();
  IDS.partner = part.id;

  // 5. Project
  await db
    .insert(project)
    .values({
      id:            IDS.project,
      code:          `PRJ-GH-TEST-${Date.now()}`,
      projectType:   "regenerative_agriculture",
      sector:        "green_economy",
      projectStage:  "active",
      projectStatus: "active",
      region:        "Greater Accra",
      country:       "Ghana",
      startDate:     "2026-01-01",
      currencyId:    IDS.currency,
      createdBy:     IDS.userId,
    })
    .onConflictDoNothing();

  // 6. FarmPlot — uses raw SQL for PostGIS GEOGRAPHY column
  //    ST_GeomFromText accepts WKT; GEOGRAPHY(Point,4326) stores it as lon/lat.
  //    Drizzle's customType passes strings as parameters; PostgreSQL does not
  //    implicitly cast text → geography, so we use db.execute with ST_GeomFromText.
  await db.execute(sql`
    INSERT INTO farm_plot (
      id, project_owner_id, country, region, area_hectares,
      boundary_verified, boundary_collection_method,
      centroid, created_at, updated_at
    )
    VALUES (
      ${IDS.farmPlot},
      ${IDS.projectOwner},
      'Ghana',
      'Greater Accra',
      5.00,
      true,
      'walked_gps',
      ST_GeomFromText('POINT(-0.342119 6.124582)', 4326),
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING
  `);
};

const destroyBaseFixtures = async () => {
  // Delete in FK dependency order
  await db.delete(mrvBlockchainAnchor);
  await db.delete(mrvVerificationResult);
  await db.delete(mrvIngestionEvent);
  await db.execute(sql`DELETE FROM farm_plot WHERE id = ${IDS.farmPlot}`);
  await db.delete(project).where(eq(project.id, IDS.project));
  await db.delete(partner).where(eq(partner.id, IDS.partner));
  await db.delete(projectOwner).where(eq(projectOwner.id, IDS.projectOwner));
  await db.delete(user).where(eq(user.id, IDS.userId));
  await db.delete(currency).where(eq(currency.id, IDS.currency));
};

const cleanMrvTables = async () => {
  //cant just delete mrv block chain anchor because it is referenced by carbon_credits
  //so first delete the carbon_credit that references the mrv block chain anchor
  await db.delete(carbonCredit);
  await db.delete(mrvBlockchainAnchor);
  await db.delete(mrvVerificationResult);
  await db.delete(mrvIngestionEvent);
};

/** Seed mrv:manage permission for the admin role */
const seedMrvPermission = async () => {
  const [perm] = await db
    .insert(permission)
    .values({ resource: "mrv", action: "manage" })
    // .onConflictDoUpdate({ target: [permission.resource, permission.action], set: { resource: "mrv" } })
    .onConflictDoNothing()
    .returning();

  await db
    .insert(rolePermission)
    .values({ roleId: 1, permissionId: perm.id })
    .onConflictDoNothing();
};

// ─── Payload factories ────────────────────────────────────────────────────────

const makeIngestionPayload = (overrides: Record<string, unknown> = {}) => ({
  ccIngestionId:  `msg-ingest-uuid-${Date.now()}`,
  projectId:      IDS.project,
  plotId:         IDS.farmPlot,
  projectOwnerId: IDS.projectOwner,
  partnerId:      IDS.partner,
  deviceId:       "cs-node-gh-test-001",
  ...overrides,
});

const makeVerificationPayload = (
  ccIngestionId: string,
  status: "SUCCESS" | "FLAGGED" | "FAILED" = "SUCCESS",
  overrides: Record<string, unknown> = {}
) => ({
  cc_ingestion_id:       ccIngestionId,
  verification_event_id: `v-verify-uuid-${Date.now()}`,
  methodology_applied:   "Verra VM0042 v2.2 - Sectoral Scope 14",
  verification_status:   status,
  ai_inference_results: {
    model_id:         "CC_ML_VERIFIER_V4_CORE",
    confidence_score: 0.9982,
    is_anomalous:     false,
    prediction_class: "baseline_consistent",
  },
  carbon_accounting: status === "FLAGGED"
    ? { gross_removals_tCO2e: null, leakage_deduction: null, buffer_contribution: null, net_credits_issued: null }
    : { gross_removals_tCO2e: 0.000142, leakage_deduction: 0.000002, buffer_contribution: 0.000010, net_credits_issued: 0.000130 },
  validation_checks: {
    geo_fence_status:   "VALID",
    hardware_integrity: "SECURE",
  },
  ...overrides,
});

const makeBlockchainPayload = (verificationEventId: string, overrides: Record<string, unknown> = {}) => ({
  verification_event_id: verificationEventId,
  blockchain_anchor: {
    network:          "Polygon_PoS_Mainnet",
    contract_address: "0x0000000000000000000000000000000000000000",
    transaction_hash: `0x${Date.now().toString(16).padStart(64, "0")}`,
    block_height:     99999999,
  },
  on_chain_metadata: {
    project_id:  "CC-PROJECT-ID-001",
    vintage:     "2026",
    batch_id:    `BATCH-ID-${Date.now()}`,
    merkle_root: `0x${Date.now().toString(16).padStart(64, "a")}`,
    audit_uri:   "ipfs://QmTestAuditCID",
  },
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("MRV Module", () => {

  beforeAll(async () => {
    await createBaseFixtures();
  });

  afterAll(async () => {
    await destroyBaseFixtures();
  });

  beforeEach(async () => {
    await cleanMrvTables();
    await db.delete(rolePermission);
    await db.delete(permission);
    await db.delete(role).where(gt(role.id, 1));
    await seedAdminPermissions();
    await seedMrvPermission();
  });

  // ─── POST /mrv/ingestions ────────────────────────────────────────────────

  describe(`POST ${BASE}/ingestions`, () => {

    it("should register an ingestion event with valid data", async () => {
      const res = await request(app)
        .post(`${BASE}/ingestions`)
        .set("Cookie", authHeaders.Cookie)
        .send(makeIngestionPayload());

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("id");
      expect(res.body.data.ingestionStatus).toBe("pending");
      expect(res.body.data.projectId).toBe(IDS.project);
      expect(res.body.data.partnerId).toBe(IDS.partner);
    });

    it("should return 409 on duplicate cc_ingestion_id", async () => {
      const payload = makeIngestionPayload({ ccIngestionId: "unique-id-dup-test" });

      const first = await request(app)
        .post(`${BASE}/ingestions`)
        .set("Cookie", authHeaders.Cookie)
        .send(payload);
      expect(first.status).toBe(201);

      const res = await request(app)
        .post(`${BASE}/ingestions`)
        .set("Cookie", authHeaders.Cookie)
        .send(payload); // same ccIngestionId

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 when partner is not approved", async () => {
      // Create a pending partner
      const [pendingPartner] = await db
        .insert(partner)
        .values({
          name:          "Pending Partner",
          partnerType:   "dMRV_provider",
          contactPerson: "Test",
          contactEmail:  "pending@test.com",
          status:        "pending",
        })
        .returning();

      const res = await request(app)
        .post(`${BASE}/ingestions`)
        .set("Cookie", authHeaders.Cookie)
        .send(makeIngestionPayload({ partnerId: pendingPartner.id }));

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("not approved");

      await db.delete(partner).where(eq(partner.id, pendingPartner.id));
    });

    it("should return 400 when farm plot boundary is not verified", async () => {
      // Insert an unverified plot using raw SQL
      const unverifiedPlotId = uuidv7();
      await db.execute(sql`
        INSERT INTO farm_plot (
          id, project_owner_id, country, region, area_hectares,
          boundary_verified, boundary_collection_method,
          centroid, created_at, updated_at
        )
        VALUES (
          ${unverifiedPlotId}, ${IDS.projectOwner},
          'Ghana', 'Volta', 2.00,
          false, 'walked_gps',
          ST_GeomFromText('POINT(-0.5 6.5)', 4326),
          NOW(), NOW()
        )
      `);

      const res = await request(app)
        .post(`${BASE}/ingestions`)
        .set("Cookie", authHeaders.Cookie)
        .send(makeIngestionPayload({ plotId: unverifiedPlotId }));

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("boundary has not been verified");

      await db.execute(sql`DELETE FROM farm_plot WHERE id = ${unverifiedPlotId}`);
    });

    it("should return 400 when farm plot uses buffered_centroid method", async () => {
      const bufferedPlotId = uuidv7();
      await db.execute(sql`
        INSERT INTO farm_plot (
          id, project_owner_id, country, region, area_hectares,
          boundary_verified, boundary_collection_method,
          centroid, created_at, updated_at
        )
        VALUES (
          ${bufferedPlotId}, ${IDS.projectOwner},
          'Ghana', 'Ashanti', 3.00,
          true, 'buffered_centroid',
          ST_GeomFromText('POINT(-1.5 7.0)', 4326),
          NOW(), NOW()
        )
      `);

      const res = await request(app)
        .post(`${BASE}/ingestions`)
        .set("Cookie", authHeaders.Cookie)
        .send(makeIngestionPayload({ plotId: bufferedPlotId }));

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("buffered centroid");

      await db.execute(sql`DELETE FROM farm_plot WHERE id = ${bufferedPlotId}`);
    });

    it("should return 400 when required fields are missing", async () => {
      const res = await request(app)
        .post(`${BASE}/ingestions`)
        .set("Cookie", authHeaders.Cookie)
        .send({ projectId: IDS.project }); // missing ccIngestionId, plotId, etc.

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Invalid request data");
    });

    it("should return 400 when projectId is not a valid UUID", async () => {
      const res = await request(app)
        .post(`${BASE}/ingestions`)
        .set("Cookie", authHeaders.Cookie)
        .send(makeIngestionPayload({ projectId: "not-a-uuid" }));

      expect(res.status).toBe(400);
    });

    it("should return 401 when not authenticated", async () => {
      const res = await request(app)
        .post(`${BASE}/ingestions`)
        .send(makeIngestionPayload());

      expect(res.status).toBe(401);
    });

    it("should return 403 when user does not have mrv:manage permission", async () => {
      // Create a role with no permissions
      const [limitedRole] = await db
        .insert(role)
        .values({ name: "limited_user", description: "No MRV access" })
        .returning();

      // Create a user with that role directly in DB
      const limitedUserId = `limited-user-${Date.now()}`;
      await db.insert(user).values({
        id:            limitedUserId,
        email:         `limited-${Date.now()}@test.io`,
        name:          "Limited User",
        firstName:     "Limited",
        lastName:      "User",
        roleId:        limitedRole.id,
        emailVerified: false,
      }).onConflictDoNothing();

      // Sign in via HTTP to get a real session cookie
      const signUpRes = await request(app)
        .post("/api/auth/sign-up/email")
        .send({
          name:      "Limited User",
          email:     `limited-${Date.now()}@test.io`,
          password:  "TestPass123!",
          firstName: "Limited",
          lastName:  "User",
        });

      // Use a user that exists with no mrv permission — signed in via helper approach
      // (We directly use the limited user created above but need their session)
      // Simplest: use getAuthHeaders with a role that has NO mrv:manage
      const { getAuthHeaders } = await import("@/tests/helper");
      const limitedHeaders = await getAuthHeaders(limitedRole.id, {
        email:     `mrv-limited-${Date.now()}@crevy-test.io`,
        firstName: "Limited",
        lastName:  "User",
      });

      const res = await request(app)
        .post(`${BASE}/ingestions`)
        .set("Cookie", limitedHeaders.Cookie)
        .send(makeIngestionPayload());

      expect(res.status).toBe(403);
    });
  });

  // ─── POST /mrv/webhook/verification ─────────────────────────────────────

  describe(`POST ${BASE}/webhook/verification`, () => {
    let registeredCcId: string;

    beforeEach(async () => {
      // Each test in this group needs an existing ingestion event.
      // Create one directly in the DB so we don't depend on the
      // "register ingestion" endpoint being correct.
      registeredCcId = `msg-ingest-webhook-${Date.now()}`;
      await db.insert(mrvIngestionEvent).values({
        ccIngestionId:      registeredCcId,
        projectId:          IDS.project,
        plotId:             IDS.farmPlot,
        projectOwnerId:     IDS.projectOwner,
        partnerId:          IDS.partner,
        deviceId:           "cs-node-test-001",
        submissionTimestamp: new Date(),
        ingestionStatus:    "pending",
      });
    });

    it("should process a SUCCESS verification webhook", async () => {
      const payload = makeVerificationPayload(registeredCcId, "SUCCESS");

      const res = await request(app)
        .post(`${BASE}/webhook/verification`)
        .set("Authorization", `Bearer ${CC_SECRET}`)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.result.verificationStatus).toBe("success");
      expect(res.body.data.result.netCreditsIssued).not.toBeNull();

      // Verify ingestion status was updated to 'verified'
      const [updated] = await db
        .select({ status: mrvIngestionEvent.ingestionStatus })
        .from(mrvIngestionEvent)
        .where(eq(mrvIngestionEvent.ccIngestionId, registeredCcId));
      expect(updated.status).toBe("verified");
    });

    it("should process a FLAGGED verification — carbon fields must be null", async () => {
      const payload = makeVerificationPayload(registeredCcId, "FLAGGED");

      const res = await request(app)
        .post(`${BASE}/webhook/verification`)
        .set("Authorization", `Bearer ${CC_SECRET}`)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.data.result.verificationStatus).toBe("flagged");
      expect(res.body.data.result.netCreditsIssued).toBeNull();
      expect(res.body.data.result.grossRemovalsTco2e).toBeNull();

      // Ingestion status must be 'flagged'
      const [updated] = await db
        .select({ status: mrvIngestionEvent.ingestionStatus })
        .from(mrvIngestionEvent)
        .where(eq(mrvIngestionEvent.ccIngestionId, registeredCcId));
      expect(updated.status).toBe("flagged");
    });

    it("should process a FAILED verification", async () => {
      const payload = makeVerificationPayload(registeredCcId, "FAILED");

      const res = await request(app)
        .post(`${BASE}/webhook/verification`)
        .set("Authorization", `Bearer ${CC_SECRET}`)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.data.result.verificationStatus).toBe("failed");

      const [updated] = await db
        .select({ status: mrvIngestionEvent.ingestionStatus })
        .from(mrvIngestionEvent)
        .where(eq(mrvIngestionEvent.ccIngestionId, registeredCcId));
      expect(updated.status).toBe("failed");
    });

    it("should return 401 when webhook secret is missing", async () => {
      const res = await request(app)
        .post(`${BASE}/webhook/verification`)
        .send(makeVerificationPayload(registeredCcId));

      expect(res.status).toBe(401);
    });

    it("should return 401 when webhook secret is wrong", async () => {
      const res = await request(app)
        .post(`${BASE}/webhook/verification`)
        .set("Authorization", "Bearer wrong-secret")
        .send(makeVerificationPayload(registeredCcId));

      expect(res.status).toBe(401);
    });

    it("should return 404 when cc_ingestion_id does not match any ingestion event", async () => {
      const res = await request(app)
        .post(`${BASE}/webhook/verification`)
        .set("Authorization", `Bearer ${CC_SECRET}`)
        .send(makeVerificationPayload("non-existent-ingestion-id"));

      expect(res.status).toBe(404);
    });

    it("should return 400 when verification_status is missing from payload", async () => {
      const { verification_status, ...incomplete } = makeVerificationPayload(registeredCcId);

      const res = await request(app)
        .post(`${BASE}/webhook/verification`)
        .set("Authorization", `Bearer ${CC_SECRET}`)
        .send(incomplete);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Invalid request data");
    });
  });

  // ─── POST /mrv/webhook/blockchain ────────────────────────────────────────

  describe(`POST ${BASE}/webhook/blockchain`, () => {
    let successVerificationEventId: string;
    let flaggedVerificationEventId: string;

    beforeEach(async () => {
      // Insert a SUCCESS verification result
      const ccId = `msg-ingest-blockchain-${Date.now()}`;
      await db.insert(mrvIngestionEvent).values({
        ccIngestionId:       ccId,
        projectId:           IDS.project,
        plotId:              IDS.farmPlot,
        projectOwnerId:      IDS.projectOwner,
        partnerId:           IDS.partner,
        submissionTimestamp: new Date(),
        ingestionStatus:     "verified",
      });

      const [ingestion] = await db
        .select()
        .from(mrvIngestionEvent)
        .where(eq(mrvIngestionEvent.ccIngestionId, ccId));

      successVerificationEventId = `v-verify-success-${Date.now()}`;
      await db.insert(mrvVerificationResult).values({
        ingestionId:         ingestion.id,
        projectId:           IDS.project,
        verificationEventId: successVerificationEventId,
        methodologyApplied:  "Verra VM0042 v2.2",
        verificationStatus:  "success",
        aiModelId:           "CC_ML_V4",
        aiConfidenceScore:   "0.9982",
        isAnomalous:         false,
        predictionClass:     "baseline_consistent",
        geoFenceStatus:      "valid",
        hardwareIntegrity:   "secure",
        grossRemovalsTco2e:  "0.000142",
        leakageDeduction:    "0.000002",
        bufferContribution:  "0.000010",
        netCreditsIssued:    "0.000130",
        receivedAt:          new Date(),
      });

      // Insert a FLAGGED verification result for rejection tests
      const flaggedCcId = `msg-ingest-flagged-${Date.now()}`;
      await db.insert(mrvIngestionEvent).values({
        ccIngestionId:       flaggedCcId,
        projectId:           IDS.project,
        plotId:              IDS.farmPlot,
        projectOwnerId:      IDS.projectOwner,
        partnerId:           IDS.partner,
        submissionTimestamp: new Date(),
        ingestionStatus:     "flagged",
      });

      const [flaggedIngestion] = await db
        .select()
        .from(mrvIngestionEvent)
        .where(eq(mrvIngestionEvent.ccIngestionId, flaggedCcId));

      flaggedVerificationEventId = `v-verify-flagged-${Date.now()}`;
      await db.insert(mrvVerificationResult).values({
        ingestionId:         flaggedIngestion.id,
        projectId:           IDS.project,
        verificationEventId: flaggedVerificationEventId,
        verificationStatus:  "flagged",
        geoFenceStatus:      "valid",
        hardwareIntegrity:   "secure",
        isAnomalous:         false,
        receivedAt:          new Date(),
      });
    });

    it("should process a blockchain anchor for a SUCCESS verification", async () => {
      const payload = makeBlockchainPayload(successVerificationEventId);

      const res = await request(app)
        .post(`${BASE}/webhook/blockchain`)
        .set("Authorization", `Bearer ${CC_SECRET}`)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.anchor).toHaveProperty("id");
      expect(res.body.data.anchor.transactionHash).toBe(
        payload.blockchain_anchor.transaction_hash
      );
      expect(res.body.data.anchor.auditUri).toBe("ipfs://QmTestAuditCID");
    });

    it("should return 400 when anchoring a FLAGGED verification", async () => {
      const res = await request(app)
        .post(`${BASE}/webhook/blockchain`)
        .set("Authorization", `Bearer ${CC_SECRET}`)
        .send(makeBlockchainPayload(flaggedVerificationEventId));

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("flagged");
    });

    it("should return 409 on duplicate anchor for the same verification result", async () => {
      const payload = makeBlockchainPayload(successVerificationEventId);

      const first = await request(app)
        .post(`${BASE}/webhook/blockchain`)
        .set("Authorization", `Bearer ${CC_SECRET}`)
        .send(payload);
      expect(first.status).toBe(200);

      // Different tx_hash but same verification_event_id → conflict on result_id
      const res = await request(app)
        .post(`${BASE}/webhook/blockchain`)
        .set("Authorization", `Bearer ${CC_SECRET}`)
        .send({
          ...payload,
          blockchain_anchor: {
            ...payload.blockchain_anchor,
            transaction_hash: `0x${"b".repeat(64)}`,
          },
          on_chain_metadata: {
            ...payload.on_chain_metadata,
            batch_id: `BATCH-ID-${Date.now()}-2`,
          },
        });

      expect(res.status).toBe(409);
    });

    it("should return 404 when verification_event_id does not exist", async () => {
      const res = await request(app)
        .post(`${BASE}/webhook/blockchain`)
        .set("Authorization", `Bearer ${CC_SECRET}`)
        .send(makeBlockchainPayload("non-existent-event-id"));

      expect(res.status).toBe(404);
    });

    it("should return 401 without webhook secret", async () => {
      const res = await request(app)
        .post(`${BASE}/webhook/blockchain`)
        .send(makeBlockchainPayload(successVerificationEventId));

      expect(res.status).toBe(401);
    });

    it("should return 400 when vintage is not a 4-digit year", async () => {
      const res = await request(app)
        .post(`${BASE}/webhook/blockchain`)
        .set("Authorization", `Bearer ${CC_SECRET}`)
        .send({
          ...makeBlockchainPayload(successVerificationEventId),
          on_chain_metadata: {
            project_id:  "CC-PROJECT-ID-001",
            vintage:     "26",       // ← invalid: not 4 digits
            batch_id:    `BATCH-ID-${Date.now()}`,
            merkle_root: "0x123",
            audit_uri:   "ipfs://QmTest",
          },
        });

      expect(res.status).toBe(400);
    });
  });

  // ─── GET /mrv/ingestions/:ccIngestionId/status ───────────────────────────

  describe(`GET ${BASE}/ingestions/:ccIngestionId/status`, () => {

    it("should return ingestion status for a known ccIngestionId", async () => {
      const ccId = `msg-ingest-get-${Date.now()}`;
      await db.insert(mrvIngestionEvent).values({
        ccIngestionId:       ccId,
        projectId:           IDS.project,
        plotId:              IDS.farmPlot,
        projectOwnerId:      IDS.projectOwner,
        partnerId:           IDS.partner,
        submissionTimestamp: new Date(),
        ingestionStatus:     "pending",
      });

      const res = await request(app)
        .get(`${BASE}/ingestions/${ccId}/status`)
        .set("Cookie", authHeaders.Cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.ccIngestionId).toBe(ccId);
      expect(res.body.data.ingestionStatus).toBe("pending");
    });

    it("should return 404 for an unknown ccIngestionId", async () => {
      const res = await request(app)
        .get(`${BASE}/ingestions/non-existent-id/status`)
        .set("Cookie", authHeaders.Cookie);

      expect(res.status).toBe(404);
    });

    it("should return 401 when not authenticated", async () => {
      const res = await request(app)
        .get(`${BASE}/ingestions/some-id/status`);

      expect(res.status).toBe(401);
    });
  });

  // ─── GET /mrv/verifications/project/:projectId ───────────────────────────

  describe(`GET ${BASE}/verifications/project/:projectId`, () => {

    it("should return an empty array when no verifications exist", async () => {
      const res = await request(app)
        .get(`${BASE}/verifications/project/${IDS.project}`)
        .set("Cookie", authHeaders.Cookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(0);
    });

    it("should return verifications for a project that has them", async () => {
      // Insert a verification result directly
      const ccId = `msg-get-verif-${Date.now()}`;
      await db.insert(mrvIngestionEvent).values({
        ccIngestionId:       ccId,
        projectId:           IDS.project,
        plotId:              IDS.farmPlot,
        projectOwnerId:      IDS.projectOwner,
        partnerId:           IDS.partner,
        submissionTimestamp: new Date(),
        ingestionStatus:     "verified",
      });

      const [ingestion] = await db
        .select()
        .from(mrvIngestionEvent)
        .where(eq(mrvIngestionEvent.ccIngestionId, ccId));

      await db.insert(mrvVerificationResult).values({
        ingestionId:         ingestion.id,
        projectId:           IDS.project,
        verificationEventId: `v-verify-list-${Date.now()}`,
        verificationStatus:  "success",
        geoFenceStatus:      "valid",
        hardwareIntegrity:   "secure",
        isAnomalous:         false,
        receivedAt:          new Date(),
      });

      const res = await request(app)
        .get(`${BASE}/verifications/project/${IDS.project}`)
        .set("Cookie", authHeaders.Cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].projectId).toBe(IDS.project);
    });

    it("should return 400 when projectId is not a valid UUID", async () => {
      const res = await request(app)
        .get(`${BASE}/verifications/project/not-a-uuid`)
        .set("Cookie", authHeaders.Cookie);

      expect(res.status).toBe(400);
    });

    it("should return 401 when not authenticated", async () => {
      const res = await request(app)
        .get(`${BASE}/verifications/project/${IDS.project}`);

      expect(res.status).toBe(401);
    });
  });
});
