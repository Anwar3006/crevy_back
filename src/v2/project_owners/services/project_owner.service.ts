// src/v2/project_owners/services/project_owner.service.ts
import { db } from "@/config/db";
import { projectOwner } from "../models/project_owner.model";
import { and, asc, count, eq, gt, SQL } from "drizzle-orm";
import AppError from "@/shared/errors/AppError";
import {
  TCreateProjectOwner,
  TListProjectOwnersQuery,
} from "../schemas/project_owner.schema";

const ProjectOwnerService = {

  createProjectOwner: async (payload: {
    userId:       string;
    adminId:      string | null;
    bankDetails?: TCreateProjectOwner["body"]["bankDetails"];
    momoDetails?: TCreateProjectOwner["body"]["momoDetails"];
  }) => {
    const { userId, adminId, bankDetails, momoDetails } = payload;

    if (await ProjectOwnerService.projectOwnerExistsByUserId(userId)) {
      throw new AppError("A project owner profile already exists for this user", 409);
    }

    const code = await ProjectOwnerService.generateProjectOwnerCode();

    const [result] = await db
      .insert(projectOwner)
      .values({
        userId,
        code,
        // adminId present → admin is onboarding someone else (onboardedBy = admin).
        // adminId null   → user self-registering (onboardedBy = their own userId).
        onboardedBy: adminId ?? userId,
        bankDetails:  bankDetails ?? null,
        momoDetails:  momoDetails ?? null,
      })
      .returning();

    return result;
  },

  updateProjectOwner: async (payload: {
    userId:       string;
    bankDetails?: TCreateProjectOwner["body"]["bankDetails"];
    momoDetails?: TCreateProjectOwner["body"]["momoDetails"];
  }) => {
    const { userId, bankDetails, momoDetails } = payload;

    if (!(await ProjectOwnerService.projectOwnerExistsByUserId(userId))) {
      throw new AppError("Project owner not found", 404);
    }

    const [result] = await db
      .update(projectOwner)
      .set({ bankDetails, momoDetails })
      .where(eq(projectOwner.userId, userId))
      .returning();

    return result;
  },

  getProjectOwner: async (userId: string) => {
    const [result] = await db
      .select()
      .from(projectOwner)
      .where(eq(projectOwner.userId, userId));

    if (!result) {
      throw new AppError(`Project owner not found for user ${userId}`, 404);
    }

    return result;
  },

  getProjectOwnerById: async (id: string) => {
    const [result] = await db
      .select()
      .from(projectOwner)
      .where(eq(projectOwner.id, id));

    if (!result) {
      throw new AppError(`Project owner not found for ID ${id}`, 404);
    }

    return result;
  },

  listProjectOwners: async (query: TListProjectOwnersQuery) => {
    // TListProjectOwnersQuery is the coerced type from Zod — limit is a number.
    // By the time this is called, validateInboundRequest has already coerced
    // query.limit from the raw Express string to a number via z.coerce.number().
    const conditions: SQL[] = [];

    if (query.cursor)             conditions.push(gt(projectOwner.id, query.cursor));
    if (query.userId)             conditions.push(eq(projectOwner.userId, query.userId));
    if (query.verificationStatus) conditions.push(eq(projectOwner.verificationStatus, query.verificationStatus));

    const results = await db
      .select()
      .from(projectOwner)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(projectOwner.id))
      .limit(query.limit + 1);   // fetch one extra to detect if there's a next page

    const hasNextPage = results.length > query.limit;
    const data        = hasNextPage ? results.slice(0, -1) : results;
    const nextCursor  = hasNextPage ? data[data.length - 1].id : null;

    return { data, nextCursor };
  },

  deleteProjectOwner: async (userId: string) => {
    if (!(await ProjectOwnerService.projectOwnerExistsByUserId(userId))) {
      throw new AppError("Project owner not found", 404);
    }
    await db.delete(projectOwner).where(eq(projectOwner.userId, userId));
  },

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * row != null (loose equality) returns false for both undefined and null.
   * The old `row !== null` (strict) returned true when row was undefined
   * (empty array destructure), causing every create to throw 409.
   */
  projectOwnerExistsByUserId: async (userId: string): Promise<boolean> => {
    const [row] = await db
      .select({ id: projectOwner.id })
      .from(projectOwner)
      .where(eq(projectOwner.userId, userId));
    return row != null;
  },

  /**
   * Uses count() instead of trying to cast a UUID id to a number.
   * `Number("018f...")` → NaN → NaN + 1 → NaN → code "PO-GH-NaN".
   */
  generateProjectOwnerCode: async (): Promise<string> => {
    const [row] = await db.select({ total: count() }).from(projectOwner);
    const next  = (row?.total ?? 0) + 1;
    return `PO-GH-${next.toString().padStart(6, "0")}`;
  },
};

export default ProjectOwnerService;
