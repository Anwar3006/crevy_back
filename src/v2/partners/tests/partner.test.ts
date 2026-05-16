// src/v2/partners/tests/partner.test.ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app from "@/index";
import settings from "@/config/settings";
import { db } from "@/config/db";
import { currency, partner } from "@/v2/parent-model";
import { eq } from "drizzle-orm";
import { authHeaders } from "@/tests/setup";

const BASE = `/api/${settings.API_VERSION}/partners`;

/**
 * ─── TEST ISOLATION STRATEGY ─────────────────────────────────────────────────
 *
 * beforeEach:  insert a test currency row (idempotent — see comment below)
 * afterEach:   delete all partners, then delete the test currency row
 *
 * WHY idempotent currency insert?
 *   If a test crashes before afterEach runs, the currency row persists in the
 *   DB. The next run's beforeEach would fail with a UNIQUE constraint error on
 *   `code` or `name`, causing every subsequent test to fail with a confusing
 *   "currencyId is 0" error rather than the actual failure.
 *
 *   We use onConflictDoUpdate to always get back the row's id — whether we
 *   just inserted it or it already existed.
 *
 * WHY "TEST" as currency code?
 *   Using a code that will never appear in seeded production data prevents
 *   conflicts with any other test or seed that inserts "USD" / "GHS" / etc.
 * ─────────────────────────────────────────────────────────────────────────────
 */

let currencyId = 0;

describe("Partner Module", () => {

  beforeEach(async () => {
    // Idempotent insert — always returns the id whether newly inserted or already existing
    const [row] = await db
      .insert(currency)
      .values({ code: "TST", name: "Test Currency" })
      .onConflictDoUpdate({
        target:  currency.code,
        set:     { name: "Test Currency" }, // no-op update; forces RETURNING to fire
      })
      .returning();

    currencyId = row.id;
  });

  afterEach(async () => {
    // Delete in FK dependency order: partner references currency
    await db.delete(partner);
    await db.delete(currency).where(eq(currency.id, currencyId));
    currencyId = 0;
  });

  // ─── POST / ─────────────────────────────────────────────────────────────

  describe(`POST ${BASE}`, () => {

    it("should create a new partner", async () => {
      const res = await request(app)
        .post(BASE)
        .set("Cookie", authHeaders.Cookie)
        .send({
          name:                    "Acme Energy Ltd",
          partnerType:             "dMRV_provider",
          contactPerson:           "Jane Doe",
          contactEmail:            "jane@acme.com",
          contactPhone:            "1234567890",
          country:                 "Ghana",
          defaultCurrencyId:       currencyId,
          hasDataSharingAgreement: false,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Partner created successfully");
      expect(res.body.data).toHaveProperty("id");
      expect(res.body.data.name).toBe("Acme Energy Ltd");
    });

    it("should return 409 when a partner with the same name already exists", async () => {
      // First creation
      const first = await request(app)
        .post(BASE)
        .set("Cookie", authHeaders.Cookie)
        .send({
          name:          "Duplicate Partner",
          partnerType:   "channel",
          contactPerson: "John Smith",
          contactEmail:  "john@dup.com",
        });
      expect(first.status).toBe(201);

      // Second creation with the same name
      const res = await request(app)
        .post(BASE)
        .set("Cookie", authHeaders.Cookie)
        .send({
          name:          "Duplicate Partner",
          partnerType:   "registry",
          contactPerson: "Jane Smith",
          contactEmail:  "jane@dup.com",
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 when name is empty", async () => {
      const res = await request(app)
        .post(BASE)
        .set("Cookie", authHeaders.Cookie)
        .send({
          name:          "",    // empty — fails z.string().min(1)
          partnerType:   "dMRV_provider",
          contactPerson: "Jane Doe",
          contactEmail:  "jane@acme.com",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Invalid request data");
      expect(res.body).toHaveProperty("errors");
    });

    it("should return 400 when partnerType is invalid", async () => {
      const res = await request(app)
        .post(BASE)
        .set("Cookie", authHeaders.Cookie)
        .send({
          name:          "Valid Name",
          partnerType:   "not_a_valid_type",  // not in the enum
          contactPerson: "Jane Doe",
          contactEmail:  "jane@acme.com",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 when contactEmail is invalid", async () => {
      const res = await request(app)
        .post(BASE)
        .set("Cookie", authHeaders.Cookie)
        .send({
          name:          "Valid Name",
          partnerType:   "dMRV_provider",
          contactPerson: "Jane Doe",
          contactEmail:  "not-an-email",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 401 when not authenticated", async () => {
      const res = await request(app)
        .post(BASE)
        .send({
          name:          "Ghost Partner",
          partnerType:   "channel",
          contactPerson: "Ghost",
          contactEmail:  "ghost@x.com",
        });

      expect(res.status).toBe(401);
    });
  });

  // ─── PUT /:id ────────────────────────────────────────────────────────────

  describe(`PUT ${BASE}/:id`, () => {

    it("should update an existing partner", async () => {
      // Create the partner first
      const created = await request(app)
        .post(BASE)
        .set("Cookie", authHeaders.Cookie)
        .send({
          name:          "Original Name",
          partnerType:   "dMRV_provider",
          contactPerson: "Original Contact",
          contactEmail:  "original@partner.com",
          defaultCurrencyId: currencyId,
        });
      expect(created.status).toBe(201);
      const partnerId = created.body.data.id;

      const res = await request(app)
        .put(`${BASE}/${partnerId}`)
        .set("Cookie", authHeaders.Cookie)
        .send({
          name:          "Updated Name",
          contactPerson: "Updated Contact",
          contactEmail:  "updated@partner.com",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Partner updated successfully");
      expect(res.body.data.name).toBe("Updated Name");
    });

    it("should return 404 when updating a partner that does not exist", async () => {
      const res = await request(app)
        .put(`${BASE}/999999`)
        .set("Cookie", authHeaders.Cookie)
        .send({
          name: "Does Not Matter",
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 when id is not a number", async () => {
      const res = await request(app)
        .put(`${BASE}/not-a-number`)
        .set("Cookie", authHeaders.Cookie)
        .send({ name: "Updated Name" });

      expect(res.status).toBe(400);
    });

    it("should return 401 when not authenticated", async () => {
      const res = await request(app)
        .put(`${BASE}/1`)
        .send({ name: "No Auth Update" });

      expect(res.status).toBe(401);
    });
  });

  // ─── GET /:id ─────────────────────────────────────────────────────────────

  describe(`GET ${BASE}/:id`, () => {

    it("should fetch a partner by id", async () => {
      const created = await request(app)
        .post(BASE)
        .set("Cookie", authHeaders.Cookie)
        .send({
          name:          "Fetchable Partner",
          partnerType:   "auditing_body",
          contactPerson: "Fetcher",
          contactEmail:  "fetch@partner.com",
        });
      expect(created.status).toBe(201);

      const res = await request(app)
        .get(`${BASE}/${created.body.data.id}`)
        .set("Cookie", authHeaders.Cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe("Fetchable Partner");
    });

    it("should return 404 when partner does not exist", async () => {
      const res = await request(app)
        .get(`${BASE}/999999`)
        .set("Cookie", authHeaders.Cookie);

      expect(res.status).toBe(404);
    });
  });
});
