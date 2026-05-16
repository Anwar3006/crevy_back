// src/v2/projects/services/project_activity.service.ts
import { db } from '@/config/db';
import { projectActivity } from '../models/project_activity.model';
import { and, asc, eq, gt, SQL } from 'drizzle-orm';
import AppError from '@/shared/errors/AppError';
import {
  TCreateProjectActivity,
  TListProjectActivitiesQuery,
  TUpdateProjectActivity,
} from '../schemas/project_activity.schema';

const ProjectActivityService = {

  /**
   * Create a new project activity (milestone).
   */
  createActivity: async (body: TCreateProjectActivity['body']) => {
    const [result] = await db
      .insert(projectActivity)
      .values({
        ...body,
      })
      .returning();

    return result;
  },

  /**
   * Update activity.
   */
  updateActivity: async (payload: {
    params: TUpdateProjectActivity['params'];
    body:   TUpdateProjectActivity['body'];
  }) => {
    const { params, body } = payload;

    const [result] = await db
      .update(projectActivity)
      .set({
        ...body,
      })
      .where(eq(projectActivity.id, params.id))
      .returning();

    if (!result) {
      throw new AppError(`Activity with id ${params.id} not found`, 404);
    }

    return result;
  },

  /**
   * Get activity by ID.
   */
  getActivityById: async (id: number) => {
    const [result] = await db
      .select()
      .from(projectActivity)
      .where(eq(projectActivity.id, id));

    if (!result) {
      throw new AppError(`Activity with id ${id} not found`, 404);
    }

    return result;
  },

  /**
   * List activities with filters.
   */
  listActivities: async (query: TListProjectActivitiesQuery) => {
    const conditions: SQL[] = [];

    if (query.cursor)         conditions.push(gt(projectActivity.id, query.cursor));
    if (query.projectId)      conditions.push(eq(projectActivity.projectId, query.projectId));
    if (query.activityStatus) conditions.push(eq(projectActivity.activityStatus, query.activityStatus));

    const results = await db
      .select()
      .from(projectActivity)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(projectActivity.id))
      .limit(query.limit + 1);

    const hasNextPage = results.length > query.limit;
    const data        = hasNextPage ? results.slice(0, -1) : results;
    const nextCursor  = hasNextPage ? data[data.length - 1].id : null;

    return { data, nextCursor };
  },

  /**
   * Delete activity.
   */
  deleteActivity: async (id: number) => {
    const [result] = await db
      .delete(projectActivity)
      .where(eq(projectActivity.id, id))
      .returning();

    if (!result) {
      throw new AppError(`Activity with id ${id} not found`, 404);
    }
  },
};

export default ProjectActivityService;
