// src/v2/projects/services/project_plot.service.ts
import { db } from '@/config/db';
import { projectPlot } from '../models/project-plot.model';
import { farmPlot } from '@/v2/parent-model';
import { and, asc, eq, gt, SQL, ne } from 'drizzle-orm';
import AppError from '@/shared/errors/AppError';
import {
  TEnrollPlot,
  TListProjectPlotsQuery,
  TUpdateProjectPlot,
} from '../schemas/project_plot.schema';

const ProjectPlotService = {

  /**
   * Enroll a farm plot in a project.
   */
  enrollPlot: async (body: TEnrollPlot['body']) => {
    // 1. Fetch total plot area to validate enrolled area
    const [plot] = await db
      .select()
      .from(farmPlot)
      .where(eq(farmPlot.id, body.plotId));

    if (!plot) {
      throw new AppError(`Farm plot with id ${body.plotId} not found`, 404);
    }

    if (body.enrolledAreaHectares > Number(plot.areaHectares)) {
      throw new AppError(
        `Enrolled area (${body.enrolledAreaHectares} ha) exceeds total plot area (${plot.areaHectares} ha)`,
        400
      );
    }

    // 2. CRITICAL: Check if this plot is already 'enrolled' in ANY other active project
    const activeEnrollment = await db
      .select()
      .from(projectPlot)
      .where(
        and(
          eq(projectPlot.plotId, body.plotId),
          eq(projectPlot.status, 'enrolled')
        )
      );

    if (activeEnrollment.length > 0) {
      throw new AppError(
        'This land plot is already enrolled in another active project. Double-counting is prohibited.',
        409
      );
    }

    const [result] = await db
      .insert(projectPlot)
      .values({
        ...body,
        enrolledAreaHectares: body.enrolledAreaHectares.toString(),
      })
      .returning();

    return result;
  },

  /**
   * Update project plot enrollment.
   */
  updateProjectPlot: async (payload: {
    params: TUpdateProjectPlot['params'];
    body:   TUpdateProjectPlot['body'];
  }) => {
    const { params, body } = payload;

    const existing = await ProjectPlotService.getProjectPlotById(params.id);

    // If updating area, re-validate
    if (body.enrolledAreaHectares) {
      const [plot] = await db
        .select()
        .from(farmPlot)
        .where(eq(farmPlot.id, existing.plotId));

      if (body.enrolledAreaHectares > Number(plot!.areaHectares)) {
        throw new AppError(`Enrolled area exceeds total plot area (${plot!.areaHectares} ha)`, 400);
      }
    }

    // If re-enrolling (status change), check for other active enrollments
    if (body.status === 'enrolled' && existing.status !== 'enrolled') {
      const otherActive = await db
        .select()
        .from(projectPlot)
        .where(
          and(
            eq(projectPlot.plotId, existing.plotId),
            eq(projectPlot.status, 'enrolled'),
            ne(projectPlot.id, params.id)
          )
        );
      
      if (otherActive.length > 0) {
        throw new AppError('Cannot re-enroll: this plot is active in another project', 409);
      }
    }

    const [result] = await db
      .update(projectPlot)
      .set({
        ...body,
        enrolledAreaHectares: body.enrolledAreaHectares?.toString(),
      })
      .where(eq(projectPlot.id, params.id))
      .returning();

    return result;
  },

  /**
   * Get project plot by ID.
   */
  getProjectPlotById: async (id: string) => {
    const [result] = await db
      .select()
      .from(projectPlot)
      .where(eq(projectPlot.id, id));

    if (!result) {
      throw new AppError(`Project-plot enrollment with id ${id} not found`, 404);
    }

    return result;
  },

  /**
   * List project plots with filters.
   */
  listProjectPlots: async (query: TListProjectPlotsQuery) => {
    const conditions: SQL[] = [];

    if (query.cursor)    conditions.push(gt(projectPlot.id, query.cursor));
    if (query.projectId) conditions.push(eq(projectPlot.projectId, query.projectId));
    if (query.plotId)    conditions.push(eq(projectPlot.plotId, query.plotId));
    if (query.status)    conditions.push(eq(projectPlot.status, query.status));

    const results = await db
      .select()
      .from(projectPlot)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(projectPlot.id))
      .limit(query.limit + 1);

    const hasNextPage = results.length > query.limit;
    const data        = hasNextPage ? results.slice(0, -1) : results;
    const nextCursor  = hasNextPage ? data[data.length - 1].id : null;

    return { data, nextCursor };
  },

  /**
   * Delete project plot enrollment.
   */
  deleteProjectPlot: async (id: string) => {
    const [result] = await db
      .delete(projectPlot)
      .where(eq(projectPlot.id, id))
      .returning();

    if (!result) {
      throw new AppError(`Project-plot enrollment with id ${id} not found`, 404);
    }
  },
};

export default ProjectPlotService;
