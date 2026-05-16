import { db } from "@/config/db";
import { farmPlot } from "../models/farm_plot.model";
import { and, asc, eq, gt, ilike, SQL } from "drizzle-orm";
import AppError from "@/shared/errors/AppError";
import { TCreateFarmPlot, TListFarmPlotsQuery, TUpdateFarmPlot } from "../schemas/farm_plot.schema";

const FarmPlotService = {

  createFarmPlot: async ({ body }: { body: TCreateFarmPlot["body"] }) => {
    const [result] = await db
      .insert(farmPlot)
      .values({
        projectOwnerId: body.projectOwnerId,
        country: body.country,
        region: body.region,
        village: body.village ?? null,
        centroid: body.centroid,
        boundary: body.boundary ?? null,
        boundaryCollectionMethod: body.boundaryCollectionMethod ?? null,
        areaHectares: body.areaHectares.toString(),
      })
      .returning();

    return result;
  },

  updateFarmPlot: async ({ body, params }: { body: TUpdateFarmPlot["body"]; params: TUpdateFarmPlot["params"] }) => {
    if (!(await FarmPlotService.farmPlotExistsById(params.id))) {
      throw new AppError(`Farm plot with id ${params.id} not found`, 404);
    }

    const [result] = await db
      .update(farmPlot)
      .set({
        ...body,
        areaHectares: body.areaHectares ? body.areaHectares.toString() : undefined,
      })
      .where(eq(farmPlot.id, params.id))
      .returning();

    return result;
  },

  getFarmPlotById: async (id: string) => {
    const [result] = await db.select().from(farmPlot).where(eq(farmPlot.id, id));

    if (!result) {
      throw new AppError(`Farm plot with id ${id} not found`, 404);
    }

    return result;
  },

  getFarmPlots: async (query: TListFarmPlotsQuery) => {
    const conditions: SQL[] = [];

    if (query.cursor)         conditions.push(gt(farmPlot.id, query.cursor));
    if (query.projectOwnerId) conditions.push(eq(farmPlot.projectOwnerId, query.projectOwnerId));
    if (query.country)        conditions.push(ilike(farmPlot.country, `%${query.country}%`));

    const results = await db
      .select()
      .from(farmPlot)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(farmPlot.id))
      .limit(query.limit + 1);

    const hasNextPage = results.length > query.limit;
    const data = hasNextPage ? results.slice(0, -1) : results;
    const nextCursor = hasNextPage ? data[data.length - 1].id : null;

    return {
      data,
      nextCursor,
    };
  },

  deleteFarmPlot: async (id: string) => {
    if (!(await FarmPlotService.farmPlotExistsById(id))) {
      throw new AppError(`Farm plot with id ${id} not found`, 404);
    }
    await db.delete(farmPlot).where(eq(farmPlot.id, id));
  },

  // ── Helpers ──────────────────────────────────────────────────────────────

  farmPlotExistsById: async (id: string) => {
    const [row] = await db
      .select({ id: farmPlot.id })
      .from(farmPlot)
      .where(eq(farmPlot.id, id));
    return row != null;
  },
};

export default FarmPlotService;
