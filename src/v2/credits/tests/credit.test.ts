import settings from '@/config/settings';
import { db } from '@/config/db';
import app from '@/index';
import { authHeaders, seedAdminPermissions } from '@/tests/setup';
import { getAuthHeaders } from '@/tests/helper';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { eq, gt, ne } from 'drizzle-orm';
import {
  carbonCredit,
  creditTransaction,
  creditVerification,
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
} from '@/v2/parent-model';

const BASE = `/api/${settings.API_VERSION}/credits`;

describe('Credits Module', () => {
  async function grantCreditsManage() {
    const [perm] = await db
      .insert(permission)
      .values({ resource: 'credits', action: 'manage' })
      .returning();

    await db
      .insert(rolePermission)
      .values({ roleId: 1, permissionId: perm.id })
      .onConflictDoNothing();

    return perm;
  }

  async function seedCurrency() {
    const [inserted] = await db
      .insert(currency)
      .values({ name: 'US Dollar', code: 'USD' })
      .onConflictDoNothing()
      .returning();

    if (inserted) return inserted;

    const [existing] = await db.select().from(currency).where(eq(currency.code, 'USD'));
    return existing;
  }

  async function seedProject() {
    const curr = await seedCurrency();
    const [prj] = await db
      .insert(project)
      .values({
        code: `PRJ-CRED-${Date.now()}`,
        name: 'Credits Test Project',
        projectType: 'regenerative_agriculture',
        sector: 'green_economy',
        region: 'Ashanti',
        country: 'GH',
        startDate: '2026-01-01',
        currencyId: curr.id,
        createdBy: authHeaders.userId,
      })
      .returning();

    return { curr, prj };
  }

  async function seedPartner(currencyId: number) {
    const [p] = await db
      .insert(partner)
      .values({
        name: `CraftedClimate Credits ${Date.now()}`,
        partnerType: 'dMRV_provider',
        contactPerson: 'Verifier',
        contactEmail: `verifier-${Date.now()}@crafted.test`,
        status: 'approved',
        defaultCurrencyId: currencyId,
      })
      .returning();

    return p;
  }

  async function seedProjectOwner() {
    const ownerUserId = `credit-owner-${Date.now()}`;

    await db
      .insert(user)
      .values({
        id: ownerUserId,
        email: `${ownerUserId}@test.io`,
        name: 'Credit Owner',
        firstName: 'Credit',
        lastName: 'Owner',
      })
      .onConflictDoNothing();

    const [owner] = await db
      .insert(projectOwner)
      .values({
        userId: ownerUserId,
        code: `PO-CREDIT-${Date.now()}`,
        onboardedBy: authHeaders.userId,
      })
      .returning();

    return owner;
  }

  async function seedAnchor(batchId = `BATCH-CREDIT-${Date.now()}`) {
    const { curr, prj } = await seedProject();
    const verifier = await seedPartner(curr.id);
    const owner = await seedProjectOwner();

    const [plot] = await db
      .insert(farmPlot)
      .values({
        projectOwnerId: owner.id,
        country: 'GH',
        region: 'Ashanti',
        centroid: 'POINT(-1.6244 6.6666)',
        areaHectares: '2.00',
      })
      .returning();

    const [ingestion] = await db
      .insert(mrvIngestionEvent)
      .values({
        ccIngestionId: `cc-credit-${Date.now()}`,
        projectId: prj.id,
        plotId: plot.id,
        projectOwnerId: owner.id,
        partnerId: verifier.id,
        ingestionStatus: 'verified',
      })
      .returning();

    const [verificationResult] = await db
      .insert(mrvVerificationResult)
      .values({
        ingestionId: ingestion.id,
        projectId: prj.id,
        verificationEventId: `v-credit-${Date.now()}`,
        verificationStatus: 'success',
        geoFenceStatus: 'valid',
        hardwareIntegrity: 'SECURE',
        netCreditsIssued: '10.000000',
      })
      .returning();

    const [anchor] = await db
      .insert(mrvBlockchainAnchor)
      .values({
        resultId: verificationResult.id,
        projectId: prj.id,
        network: 'polygon',
        contractAddress: '0xcontract',
        transactionHash: `0xtx-${Date.now()}`,
        blockHeight: 123456,
        batchId,
        vintage: 2026,
        merkleRoot: '0xmerkle',
        auditUri: 'ipfs://audit',
      })
      .returning();

    return { curr, prj, verifier, anchor };
  }

  async function seedCredit(amount = 10) {
    const { curr, prj, anchor } = await seedAnchor();

    const [credit] = await db
      .insert(carbonCredit)
      .values({
        projectId: prj.id,
        serialNumberStart: `${anchor.batchId}-000001`,
        serialNumberEnd: `${anchor.batchId}-000010`,
        totalAmount: amount.toFixed(6),
        availableAmount: amount.toFixed(6),
        creditVintage: 2026,
        creditStatus: 'available',
        mrv_batch_id: anchor.batchId,
        blockchainTxHash: anchor.transactionHash,
        currentOwnerId: authHeaders.userId,
        issuanceDate: '2026-05-01',
      })
      .returning();

    return { curr, prj, anchor, credit };
  }

  beforeEach(async () => {
    await db.delete(carbonCredit);
    await db.delete(creditTransaction);
    await db.delete(creditVerification);
    await db.delete(mrvBlockchainAnchor);
    await db.delete(mrvVerificationResult);
    await db.delete(mrvIngestionEvent);
    await db.delete(farmPlot);
    await db.delete(projectOwner);
    await db.delete(project);
    await db.delete(partner);
    await db.delete(rolePermission);
    await db.delete(permission);
    await db.delete(role).where(gt(role.id, 1));
    await db.delete(user).where(ne(user.id, authHeaders.userId));
    await seedAdminPermissions();
    await grantCreditsManage();
  });

  afterEach(async () => {
    await db.delete(carbonCredit);
    await db.delete(creditTransaction);
    await db.delete(creditVerification);
  });

  it('should allow an admin to create a carbon credit batch', async () => {
    const { prj, anchor } = await seedAnchor();

    const res = await request(app)
      .post(`${BASE}/carbon-credits`)
      .set('Cookie', authHeaders.Cookie)
      .send({
        projectId: prj.id,
        serialNumberStart: 'GH-2026-0001',
        serialNumberEnd: 'GH-2026-0010',
        totalAmount: 10,
        availableAmount: 10,
        creditVintage: 2026,
        mrv_batch_id: anchor.batchId,
        blockchainTxHash: anchor.transactionHash,
        currentOwnerId: authHeaders.userId,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.creditStatus).toBe('available');
    expect(Number(res.body.data.availableAmount)).toBe(10);
  });

  it('should reject carbon credit creation when available amount exceeds total amount', async () => {
    const { prj, anchor } = await seedAnchor();

    const res = await request(app)
      .post(`${BASE}/carbon-credits`)
      .set('Cookie', authHeaders.Cookie)
      .send({
        projectId: prj.id,
        serialNumberStart: 'GH-2026-0001',
        serialNumberEnd: 'GH-2026-0010',
        totalAmount: 5,
        availableAmount: 6,
        creditVintage: 2026,
        mrv_batch_id: anchor.batchId,
        blockchainTxHash: anchor.transactionHash,
        currentOwnerId: authHeaders.userId,
      });

    expect(res.status).toBe(400);
  });

  it('should purchase credits, create a transaction, and reduce seller availability', async () => {
    const { curr, credit } = await seedCredit(10);
    const buyer = await getAuthHeaders(1, { email: `buyer-${Date.now()}@test.io` });

    const res = await request(app)
      .post(`${BASE}/carbon-credits/${credit.id}/purchase`)
      .set('Cookie', buyer.Cookie)
      .send({
        quantity: 4,
        pricePerCredit: 12.5,
        currencyId: curr.id,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.transaction.buyerId).toBe(buyer.userId);
    expect(Number(res.body.data.transaction.totalAmount)).toBe(50);
    expect(Number(res.body.data.remainingAmount)).toBe(6);

    const [updated] = await db.select().from(carbonCredit).where(eq(carbonCredit.id, credit.id));
    expect(Number(updated.availableAmount)).toBe(6);
  });

  it('should prevent overselling available credits', async () => {
    const { curr, credit } = await seedCredit(3);

    const res = await request(app)
      .post(`${BASE}/carbon-credits/${credit.id}/purchase`)
      .set('Cookie', authHeaders.Cookie)
      .send({
        quantity: 4,
        pricePerCredit: 10,
        currencyId: curr.id,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('exceeds available');
  });

  it('should allow the current owner to retire credits', async () => {
    const { credit } = await seedCredit(5);

    const res = await request(app)
      .post(`${BASE}/carbon-credits/${credit.id}/retire`)
      .set('Cookie', authHeaders.Cookie)
      .send({ quantity: 2, notes: 'Corporate retirement' });

    expect(res.status).toBe(201);
    expect(res.body.data.retiredCredit.creditStatus).toBe('retired');
    expect(Number(res.body.data.remainingAmount)).toBe(3);
  });

  it('should create and list business-layer credit verifications', async () => {
    const { curr, prj } = await seedProject();
    const verifier = await seedPartner(curr.id);

    const res = await request(app)
      .post(`${BASE}/verifications`)
      .set('Cookie', authHeaders.Cookie)
      .send({
        projectId: prj.id,
        verifierPartnerId: verifier.id,
        verificationEventId: `verify-event-${Date.now()}`,
        methodologyApplied: 'VM0047',
        verificationDate: '2026-05-01',
        verificationStatus: 'success',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.verificationStatus).toBe('success');

    const list = await request(app)
      .get(`${BASE}/verifications?projectId=${prj.id}`)
      .set('Cookie', authHeaders.Cookie);

    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
  });

  it('should return 403 when a user without credits:manage creates credits', async () => {
    const [limitedRole] = await db
      .insert(role)
      .values({ name: `limited-${Date.now()}`, description: 'Limited role' })
      .returning();

    const limited = await getAuthHeaders(limitedRole.id, { email: `limited-${Date.now()}@test.io` });
    const { prj, anchor } = await seedAnchor();

    const res = await request(app)
      .post(`${BASE}/carbon-credits`)
      .set('Cookie', limited.Cookie)
      .send({
        projectId: prj.id,
        serialNumberStart: 'GH-2026-0001',
        serialNumberEnd: 'GH-2026-0010',
        totalAmount: 10,
        creditVintage: 2026,
        mrv_batch_id: anchor.batchId,
        blockchainTxHash: anchor.transactionHash,
        currentOwnerId: limited.userId,
      });

    expect(res.status).toBe(403);
  });
});
