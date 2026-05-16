// src/v2/financials/services/financials.service.ts
import { db } from "@/config/db";
import { eq, and, gt, asc, desc, SQL } from "drizzle-orm";
import { contract } from "../models/contract.model";
import { payout } from "../models/payout.model";
import { financialRecord } from "../models/financial_record.model";
import AppError from "@/shared/errors/AppError";
import {
  TCreateContract,
  TUpdateContract,
  TCreatePayout,
  TUpdatePayout,
  TCreateFinancialRecord,
  TListFinancialsQuery,
} from "../schemas/financials.schema";

const FinancialsService = {
  // ─── Contract ────────────────────────────────────────────────────────────────

  createContract: async (body: TCreateContract["body"]) => {
    const [result] = await db
      .insert(contract)
      .values(body)
      .returning();
    return result;
  },

  updateContract: async (id: string, body: TUpdateContract["body"]) => {
    const [result] = await db
      .update(contract)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(eq(contract.id, id))
      .returning();
    if (!result) throw new AppError(`Contract with id ${id} not found`, 404);
    return result;
  },

  getContractById: async (id: string) => {
    const [result] = await db.select().from(contract).where(eq(contract.id, id));
    if (!result) throw new AppError(`Contract with id ${id} not found`, 404);
    return result;
  },

  listContracts: async (query: TListFinancialsQuery) => {
    const conditions: SQL[] = [];
    if (query.cursor) conditions.push(gt(contract.id, query.cursor));
    if (query.status) conditions.push(eq(contract.status, query.status as any));

    return db
      .select()
      .from(contract)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(contract.id))
      .limit(query.limit);
  },

  // ─── Payout ──────────────────────────────────────────────────────────────────

  createPayout: async (body: TCreatePayout["body"]) => {
    const [result] = await db
      .insert(payout)
      .values(body)
      .returning();
    return result;
  },

  updatePayout: async (id: string, body: TUpdatePayout["body"]) => {
    const [result] = await db
      .update(payout)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(eq(payout.id, id))
      .returning();
    if (!result) throw new AppError(`Payout with id ${id} not found`, 404);
    return result;
  },

  getPayoutById: async (id: string) => {
    const [result] = await db.select().from(payout).where(eq(payout.id, id));
    if (!result) throw new AppError(`Payout with id ${id} not found`, 404);
    return result;
  },

  listPayouts: async (query: TListFinancialsQuery) => {
    const conditions: SQL[] = [];
    if (query.cursor) conditions.push(gt(payout.id, query.cursor));
    if (query.status) conditions.push(eq(payout.payoutStatus, query.status as any));

    return db
      .select()
      .from(payout)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(payout.id))
      .limit(query.limit);
  },

  // ─── Financial Record ────────────────────────────────────────────────────────

  createFinancialRecord: async (body: TCreateFinancialRecord["body"]) => {
    const [result] = await db
      .insert(financialRecord)
      .values(body)
      .returning();
    return result;
  },

  getFinancialRecordById: async (id: string) => {
    const [result] = await db.select().from(financialRecord).where(eq(financialRecord.id, id));
    if (!result) throw new AppError(`Financial record with id ${id} not found`, 404);
    return result;
  },

  listFinancialRecords: async (query: TListFinancialsQuery) => {
    const conditions: SQL[] = [];
    if (query.cursor) conditions.push(gt(financialRecord.id, query.cursor));
    if (query.type) conditions.push(eq(financialRecord.recordType, query.type as any));

    return db
      .select()
      .from(financialRecord)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(financialRecord.id))
      .limit(query.limit);
  },
};

export default FinancialsService;
