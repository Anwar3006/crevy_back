import { db } from '@/config/db';
import AppError from '@/shared/errors/AppError';
import { and, asc, eq, SQL } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { carbonCredit } from '../models/carbon_credit.model';
import { creditTransaction } from '../models/credit_transaction.model';
import { creditVerification } from '../models/verification.model';
import {
  currency,
  mrvBlockchainAnchor,
  partner,
  project,
  projectOwner,
  projectOwnerEnrollment,
} from '@/v2/parent-model';
import {
  TCreateCarbonCredit,
  TCreateCreditVerification,
  TListCarbonCreditsQuery,
  TListCreditTransactionsQuery,
  TListCreditVerificationsQuery,
  TPurchaseCarbonCredit,
  TRetireCarbonCredit,
  TUpdateCarbonCreditStatus,
  TUpdateCreditVerification,
} from '../schemas/credit.schema';

const toDecimalString = (value: number) => value.toFixed(6);
const toMoneyString = (value: number) => value.toFixed(2);

const CreditService = {
  createCarbonCredit: async (body: TCreateCarbonCredit['body']) => {
    await CreditService.assertProjectExists(body.projectId);
    await CreditService.assertBlockchainBatchExists(body.mrv_batch_id);

    const availableAmount = body.availableAmount ?? body.totalAmount;

    const [result] = await db
      .insert(carbonCredit)
      .values({
        ...body,
        totalAmount: toDecimalString(body.totalAmount),
        availableAmount: toDecimalString(availableAmount),
      })
      .returning();

    return result;
  },

  issueCredits: async (payload: {
    projectId: string;
    netCreditsIssued: number;
    batchId: string;
    vintage: number;
    blockchainTxHash: string;
    generationDate?: string;
    verificationDate?: string;
    ownerId?: string;
  }) => {
    if (payload.netCreditsIssued <= 0) {
      throw new AppError('netCreditsIssued must be greater than zero', 400);
    }

    const ownerId = payload.ownerId ?? await CreditService.resolvePrimaryProjectOwnerUserId(payload.projectId);

    const serialNumberStart = `${payload.batchId}-000001`;
    const serialNumberEnd = `${payload.batchId}-${Math.ceil(payload.netCreditsIssued).toString().padStart(6, '0')}`;

    const [existing] = await db
      .select({ id: carbonCredit.id })
      .from(carbonCredit)
      .where(eq(carbonCredit.mrv_batch_id, payload.batchId));

    if (existing) {
      throw new AppError(`Credits have already been issued for batch ${payload.batchId}`, 409);
    }

    const [credit] = await db
      .insert(carbonCredit)
      .values({
        projectId: payload.projectId,
        serialNumberStart,
        serialNumberEnd,
        totalAmount: toDecimalString(payload.netCreditsIssued),
        availableAmount: toDecimalString(payload.netCreditsIssued),
        creditVintage: payload.vintage,
        creditStatus: 'available',
        mrv_batch_id: payload.batchId,
        blockchainTxHash: payload.blockchainTxHash,
        currentOwnerId: ownerId,
        generationDate: payload.generationDate,
        verificationDate: payload.verificationDate,
        issuanceDate: new Date().toISOString().slice(0, 10),
      })
      .returning();

    return credit;
  },

  getCarbonCreditById: async (id: string) => {
    const [result] = await db.select().from(carbonCredit).where(eq(carbonCredit.id, id));
    if (!result) throw new AppError(`Carbon credit with id ${id} not found`, 404);
    return result;
  },

  listCarbonCredits: async (query: TListCarbonCreditsQuery) => {
    const conditions: SQL[] = [];

    if (query.projectId) conditions.push(eq(carbonCredit.projectId, query.projectId));
    if (query.currentOwnerId) conditions.push(eq(carbonCredit.currentOwnerId, query.currentOwnerId));
    if (query.creditStatus) conditions.push(eq(carbonCredit.creditStatus, query.creditStatus));
    if (query.creditVintage) conditions.push(eq(carbonCredit.creditVintage, query.creditVintage));
    if (query.mrv_batch_id) conditions.push(eq(carbonCredit.mrv_batch_id, query.mrv_batch_id));

    return db
      .select()
      .from(carbonCredit)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(carbonCredit.createdAt))
      .limit(query.limit)
      .offset(query.offset);
  },

  updateCarbonCreditStatus: async (payload: TUpdateCarbonCreditStatus) => {
    const [result] = await db
      .update(carbonCredit)
      .set({ creditStatus: payload.body.creditStatus })
      .where(eq(carbonCredit.id, payload.params.id))
      .returning();

    if (!result) {
      throw new AppError(`Carbon credit with id ${payload.params.id} not found`, 404);
    }

    return result;
  },

  purchaseCarbonCredit: async (payload: TPurchaseCarbonCredit & { buyerId: string }) => {
    return db.transaction(async (tx) => {
      const [sourceCredit] = await tx
        .select()
        .from(carbonCredit)
        .where(eq(carbonCredit.id, payload.params.id));

      if (!sourceCredit) {
        throw new AppError(`Carbon credit with id ${payload.params.id} not found`, 404);
      }

      if (sourceCredit.creditStatus !== 'available' && sourceCredit.creditStatus !== 'reserved') {
        throw new AppError(`Carbon credit is not available for purchase. Current status: ${sourceCredit.creditStatus}`, 400);
      }

      const availableAmount = Number(sourceCredit.availableAmount);
      if (payload.body.quantity > availableAmount) {
        throw new AppError('Purchase quantity exceeds available credit amount', 400);
      }

      const remainingAmount = availableAmount - payload.body.quantity;
      const totalAmount = payload.body.quantity * payload.body.pricePerCredit;

      const [currencyRow] = await tx
        .select({ id: currency.id })
        .from(currency)
        .where(eq(currency.id, payload.body.currencyId));
      if (!currencyRow) {
        throw new AppError(`Currency with id ${payload.body.currencyId} not found`, 404);
      }

      const [transaction] = await tx
        .insert(creditTransaction)
        .values({
          transactionRef: `CRV-${Date.now()}-${nanoid(8)}`,
          buyerId: payload.buyerId,
          sellerId: sourceCredit.currentOwnerId,
          isInternalSale: false,
          quantity: toMoneyString(payload.body.quantity),
          pricePerCredit: toMoneyString(payload.body.pricePerCredit),
          totalAmount: toMoneyString(totalAmount),
          currencyId: payload.body.currencyId,
          transactionStatus: 'completed',
          notes: payload.body.notes,
        })
        .returning();

      await tx
        .update(carbonCredit)
        .set({
          availableAmount: toDecimalString(remainingAmount),
          creditStatus: remainingAmount === 0 ? 'sold' : 'available',
        })
        .where(eq(carbonCredit.id, sourceCredit.id));

      const [buyerCredit] = await tx
        .insert(carbonCredit)
        .values({
          projectId: sourceCredit.projectId,
          serialNumberStart: sourceCredit.serialNumberStart,
          serialNumberEnd: sourceCredit.serialNumberEnd,
          totalAmount: toDecimalString(payload.body.quantity),
          availableAmount: toDecimalString(payload.body.quantity),
          creditVintage: sourceCredit.creditVintage,
          creditStatus: 'available',
          mrv_batch_id: sourceCredit.mrv_batch_id,
          blockchainTxHash: sourceCredit.blockchainTxHash,
          currentOwnerId: payload.buyerId,
          registry: sourceCredit.registry,
          generationDate: sourceCredit.generationDate,
          verificationDate: sourceCredit.verificationDate,
          issuanceDate: sourceCredit.issuanceDate,
          transactionId: transaction.id,
        })
        .returning();

      return { transaction, buyerCredit, remainingAmount: toDecimalString(remainingAmount) };
    });
  },

  retireCarbonCredit: async (payload: TRetireCarbonCredit & { ownerId: string }) => {
    return db.transaction(async (tx) => {
      const [sourceCredit] = await tx
        .select()
        .from(carbonCredit)
        .where(eq(carbonCredit.id, payload.params.id));

      if (!sourceCredit) {
        throw new AppError(`Carbon credit with id ${payload.params.id} not found`, 404);
      }

      if (sourceCredit.currentOwnerId !== payload.ownerId) {
        throw new AppError('Only the current credit owner can retire this credit', 403);
      }

      const availableAmount = Number(sourceCredit.availableAmount);
      if (payload.body.quantity > availableAmount) {
        throw new AppError('Retirement quantity exceeds available credit amount', 400);
      }

      const remainingAmount = availableAmount - payload.body.quantity;

      await tx
        .update(carbonCredit)
        .set({
          availableAmount: toDecimalString(remainingAmount),
          creditStatus: remainingAmount === 0 ? 'retired' : sourceCredit.creditStatus,
        })
        .where(eq(carbonCredit.id, sourceCredit.id));

      const [retiredCredit] = await tx
        .insert(carbonCredit)
        .values({
          projectId: sourceCredit.projectId,
          serialNumberStart: sourceCredit.serialNumberStart,
          serialNumberEnd: sourceCredit.serialNumberEnd,
          totalAmount: toDecimalString(payload.body.quantity),
          availableAmount: '0.000000',
          creditVintage: sourceCredit.creditVintage,
          creditStatus: 'retired',
          mrv_batch_id: sourceCredit.mrv_batch_id,
          blockchainTxHash: sourceCredit.blockchainTxHash,
          currentOwnerId: payload.ownerId,
          registry: sourceCredit.registry,
          generationDate: sourceCredit.generationDate,
          verificationDate: sourceCredit.verificationDate,
          issuanceDate: sourceCredit.issuanceDate,
        })
        .returning();

      return { retiredCredit, remainingAmount: toDecimalString(remainingAmount) };
    });
  },

  listTransactions: async (query: TListCreditTransactionsQuery) => {
    const conditions: SQL[] = [];

    if (query.buyerId) conditions.push(eq(creditTransaction.buyerId, query.buyerId));
    if (query.sellerId) conditions.push(eq(creditTransaction.sellerId, query.sellerId));
    if (query.transactionStatus) conditions.push(eq(creditTransaction.transactionStatus, query.transactionStatus));

    return db
      .select()
      .from(creditTransaction)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(creditTransaction.transactionDate))
      .limit(query.limit)
      .offset(query.offset);
  },

  getTransactionById: async (id: string) => {
    const [result] = await db.select().from(creditTransaction).where(eq(creditTransaction.id, id));
    if (!result) throw new AppError(`Credit transaction with id ${id} not found`, 404);
    return result;
  },

  createVerification: async (body: TCreateCreditVerification['body']) => {
    await CreditService.assertProjectExists(body.projectId);
    await CreditService.assertPartnerExists(body.verifierPartnerId);

    const [duplicate] = await db
      .select({ id: creditVerification.id })
      .from(creditVerification)
      .where(eq(creditVerification.verificationEventId, body.verificationEventId));
    if (duplicate) {
      throw new AppError(`Verification event ${body.verificationEventId} already exists`, 409);
    }

    const [result] = await db.insert(creditVerification).values(body).returning();
    return result;
  },

  updateVerification: async (payload: TUpdateCreditVerification) => {
    const [result] = await db
      .update(creditVerification)
      .set(payload.body)
      .where(eq(creditVerification.id, payload.params.id))
      .returning();

    if (!result) {
      throw new AppError(`Credit verification with id ${payload.params.id} not found`, 404);
    }

    return result;
  },

  getVerificationById: async (id: string) => {
    const [result] = await db.select().from(creditVerification).where(eq(creditVerification.id, id));
    if (!result) throw new AppError(`Credit verification with id ${id} not found`, 404);
    return result;
  },

  listVerifications: async (query: TListCreditVerificationsQuery) => {
    const conditions: SQL[] = [];

    if (query.projectId) conditions.push(eq(creditVerification.projectId, query.projectId));
    if (query.verifierPartnerId) conditions.push(eq(creditVerification.verifierPartnerId, query.verifierPartnerId));
    if (query.verificationStatus) conditions.push(eq(creditVerification.verificationStatus, query.verificationStatus));

    return db
      .select()
      .from(creditVerification)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(creditVerification.createdAt))
      .limit(query.limit)
      .offset(query.offset);
  },

  assertProjectExists: async (projectId: string) => {
    const [projectRow] = await db.select({ id: project.id }).from(project).where(eq(project.id, projectId));
    if (!projectRow) throw new AppError(`Project with id ${projectId} not found`, 404);
  },

  assertPartnerExists: async (partnerId: number) => {
    const [partnerRow] = await db.select({ id: partner.id }).from(partner).where(eq(partner.id, partnerId));
    if (!partnerRow) throw new AppError(`Partner with id ${partnerId} not found`, 404);
  },

  assertBlockchainBatchExists: async (batchId: string) => {
    const [anchor] = await db
      .select({ batchId: mrvBlockchainAnchor.batchId })
      .from(mrvBlockchainAnchor)
      .where(eq(mrvBlockchainAnchor.batchId, batchId));
    if (!anchor) throw new AppError(`MRV blockchain batch ${batchId} not found`, 404);
  },

  resolvePrimaryProjectOwnerUserId: async (projectId: string) => {
    const [owner] = await db
      .select({ userId: projectOwner.userId })
      .from(projectOwnerEnrollment)
      .innerJoin(projectOwner, eq(projectOwnerEnrollment.projectOwnerId, projectOwner.id))
      .where(
        and(
          eq(projectOwnerEnrollment.projectId, projectId),
          eq(projectOwnerEnrollment.participationStatus, 'active'),
        ),
      )
      .limit(1);

    if (!owner) {
      const [projectRow] = await db
        .select({ createdBy: project.createdBy })
        .from(project)
        .where(eq(project.id, projectId));

      if (!projectRow) {
        throw new AppError(`Project with id ${projectId} not found`, 404);
      }

      return projectRow.createdBy;
    }

    return owner.userId;
  },
};

export default CreditService;
