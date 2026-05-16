// src/v2/projects/services/project_enrollment.service.ts
import { db } from '@/config/db';
import { projectOwnerEnrollment } from '../models/project-owner_enrollment.model';
import { and, asc, eq, gt, SQL } from 'drizzle-orm';
import AppError from '@/shared/errors/AppError';
import {
  TEnrollProjectOwner,
  TListEnrollmentsQuery,
  TUpdateEnrollment,
} from '../schemas/project_enrollment.schema';

const ProjectEnrollmentService = {

  /**
   * Enroll a project owner in a project.
   */
  enrollProjectOwner: async (body: TEnrollProjectOwner['body']) => {
    // Check if already enrolled
    const existing = await db
      .select()
      .from(projectOwnerEnrollment)
      .where(
        and(
          eq(projectOwnerEnrollment.projectId,      body.projectId),
          eq(projectOwnerEnrollment.projectOwnerId, body.projectOwnerId)
        )
      );

    if (existing.length > 0) {
      throw new AppError('This project owner is already enrolled in a project', 409);
    }

    const [result] = await db
      .insert(projectOwnerEnrollment)
      .values({
        ...body,
      })
      .returning();

    return result;
  },

  /**
   * Update enrollment status.
   */
  updateEnrollment: async (payload: {
    params: TUpdateEnrollment['params'];
    body:   TUpdateEnrollment['body'];
  }) => {
    const { params, body } = payload;

    const [result] = await db
      .update(projectOwnerEnrollment)
      .set({
        ...body,
      })
      .where(eq(projectOwnerEnrollment.id, params.id))
      .returning();

    if (!result) {
      throw new AppError(`Enrollment with id ${params.id} not found`, 404);
    }

    return result;
  },

  /**
   * Get enrollment by ID.
   */
  getEnrollmentById: async (id: string) => {
    const [result] = await db
      .select()
      .from(projectOwnerEnrollment)
      .where(eq(projectOwnerEnrollment.id, id));

    if (!result) {
      throw new AppError(`Enrollment with id ${id} not found`, 404);
    }

    return result;
  },

  /**
   * List enrollments with filters.
   */
  listEnrollments: async (query: TListEnrollmentsQuery) => {
    const conditions: SQL[] = [];

    if (query.cursor)              conditions.push(gt(projectOwnerEnrollment.id, query.cursor));
    if (query.projectId)           conditions.push(eq(projectOwnerEnrollment.projectId, query.projectId));
    if (query.projectOwnerId)      conditions.push(eq(projectOwnerEnrollment.projectOwnerId, query.projectOwnerId));
    if (query.participationStatus) conditions.push(eq(projectOwnerEnrollment.participationStatus, query.participationStatus));

    const results = await db
      .select()
      .from(projectOwnerEnrollment)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(projectOwnerEnrollment.id))
      .limit(query.limit + 1);

    const hasNextPage = results.length > query.limit;
    const data        = hasNextPage ? results.slice(0, -1) : results;
    const nextCursor  = hasNextPage ? data[data.length - 1].id : null;

    return { data, nextCursor };
  },

  /**
   * Delete an enrollment.
   */
  deleteEnrollment: async (id: string) => {
    const [result] = await db
      .delete(projectOwnerEnrollment)
      .where(eq(projectOwnerEnrollment.id, id))
      .returning();

    if (!result) {
      throw new AppError(`Enrollment with id ${id} not found`, 404);
    }
  },
};

export default ProjectEnrollmentService;
