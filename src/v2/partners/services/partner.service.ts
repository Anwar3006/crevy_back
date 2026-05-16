// src/v2/partners/services/partner.service.ts
import { db } from "@/config/db";
import { TCreatePartner, TListPartnersQuery, TPartner, TUpdatePartner } from "../schema/partner.schema";
import { partner } from "../models/partner.model";
import { and, asc, eq, gt, ilike, SQL } from "drizzle-orm";
import AppError from "@/shared/errors/AppError";

type TPartnerService = {
  createPartner:  (payload: { body: TCreatePartner["body"] }) => Promise<TPartner>;
  updatePartner:  (payload: { body: TUpdatePartner["body"]; params: TUpdatePartner["params"] }) => Promise<TPartner>;
  getPartnerById: (id: number) => Promise<TPartner>;
  getPartners:    (query: TListPartnersQuery) => Promise<{ data: TPartner[]; nextCursor: number | null }>;
  deletePartner:  (id: number) => Promise<void>;
  // helpers
  partnerExistsByName: (name: string) => Promise<boolean>;
  partnerExistsById:   (id: number)   => Promise<boolean>;
};

const PartnerService: TPartnerService = {

  createPartner: async ({ body }) => {
    // Prevent duplicate partner names (name is UNIQUE in the DB, but a clear
    // application-level message is better than a raw DB constraint error)
    if (await PartnerService.partnerExistsByName(body.name)) {
      throw new AppError(`A partner named "${body.name}" already exists`, 409);
    }

    const [result] = await db
      .insert(partner)
      .values({
        name:                    body.name,
        partnerType:             body.partnerType,
        contactPerson:           body.contactPerson,
        contactEmail:            body.contactEmail,
        contactPhone:            body.contactPhone,
        country:                 body.country,
        defaultCurrencyId:       body.defaultCurrencyId ?? null,
        hasDataSharingAgreement: body.hasDataSharingAgreement ?? false,
      })
      .returning();

    return result as TPartner;
  },

  updatePartner: async ({ body, params }) => {
    // Verify the partner we are updating actually exists
    if (!(await PartnerService.partnerExistsById(params.id))) {
      throw new AppError(`Partner with id ${params.id} not found`, 404);
    }

    // If the name is being changed, ensure the new name is not already taken
    if (body.name && (await PartnerService.partnerExistsByName(body.name))) {
      // Allow the update if the name belongs to THIS partner (same id)
      const [current] = await db
        .select({ id: partner.id })
        .from(partner)
        .where(and(eq(partner.name, body.name)));

      if (current && current.id !== params.id) {
        throw new AppError(`A partner named "${body.name}" already exists`, 409);
      }
    }

    // Drizzle ignores `undefined` values in set() — only provided fields are updated
    const [result] = await db
      .update(partner)
      .set(body)
      .where(eq(partner.id, params.id))
      .returning();

    return result as TPartner;
  },

  getPartnerById: async (id) => {
    const [result] = await db.select().from(partner).where(eq(partner.id, id));

    if (!result) {
      throw new AppError(`Partner with id ${id} not found`, 404);
    }

    return result as TPartner;
  },

  getPartners: async (query) => {
    const conditions: SQL[] = [];

    if (query.cursor)      conditions.push(gt(partner.id, query.cursor));
    if (query.name)        conditions.push(ilike(partner.name,    `%${query.name}%`));
    if (query.partnerType) conditions.push(eq(partner.partnerType, query.partnerType));
    if (query.country)     conditions.push(ilike(partner.country!,  `%${query.country}%`));
    if (query.status)      conditions.push(eq(partner.status,      query.status));

    const results = await db
      .select()
      .from(partner)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(partner.id))
      .limit(query.limit + 1);

    const hasNextPage = results.length > query.limit;
    const data = hasNextPage ? results.slice(0, -1) : results;
    const nextCursor = hasNextPage ? data[data.length - 1].id : null;

    return {
      data: data as TPartner[],
      nextCursor,
    };
  },

  deletePartner: async (id) => {
    if (!(await PartnerService.partnerExistsById(id))) {
      throw new AppError(`Partner with id ${id} not found`, 404);
    }
    await db.delete(partner).where(eq(partner.id, id));
  },

  // ── Helpers ──────────────────────────────────────────────────────────────

  partnerExistsByName: async (name) => {
    const [row] = await db
      .select({ id: partner.id })
      .from(partner)
      .where(eq(partner.name, name));
    return row != null;
  },

  partnerExistsById: async (id) => {
    const [row] = await db
      .select({ id: partner.id })
      .from(partner)
      .where(eq(partner.id, id));
    return row != null;
  },
};

export default PartnerService;
