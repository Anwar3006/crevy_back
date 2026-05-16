// src/v2/projects/services/project.service.ts
import { db } from '@/config/db';
import { project } from '../models/project.model';
import { and, asc, eq, gt, ilike, SQL } from 'drizzle-orm';
import AppError from '@/shared/errors/AppError';
import {
  TCreateProject,
  TListProjectsQuery,
  TUpdateProject,
} from '../schemas/project.schema';

const ProjectService = {

  /**
   * Create a new project.
   * Generates a unique code: PRJ-{COUNTRY}-{YEAR}-{SEQUENCE}
   */
  createProject: async (payload: {
    body:      TCreateProject['body'];
    createdBy: string;
  }) => {
    const { body, createdBy } = payload;
    const year = new Date().getFullYear();
    
    // Generate code: PRJ-GH-2026-001
    // We count existing projects for the same country and year to get the sequence
    const existingCount = await db
      .select()
      .from(project)
      .where(
        and(
          eq(project.country, body.country),
          ilike(project.code, `%-${year}-%`)
        )
      );

    const sequence = (existingCount.length + 1).toString().padStart(3, '0');
    const code = `PRJ-${body.country.toUpperCase()}-${year}-${sequence}`;

    const [result] = await db
      .insert(project)
      .values({
        ...body,
        code,
        createdBy,
      })
      .returning();

    return result;
  },

  /**
   * Update a project.
   */
  updateProject: async (payload: {
    params: TUpdateProject['params'];
    body:   TUpdateProject['body'];
  }) => {
    const { params, body } = payload;

    const [result] = await db
      .update(project)
      .set({
        ...body,
      })
      .where(eq(project.id, params.id))
      .returning();

    if (!result) {
      throw new AppError(`Project with id ${params.id} not found`, 404);
    }

    return result;
  },

  /**
   * Get a project by ID.
   */
  getProjectById: async (id: string) => {
    const [result] = await db
      .select()
      .from(project)
      .where(eq(project.id, id));

    if (!result) {
      throw new AppError(`Project with id ${id} not found`, 404);
    }

    return result;
  },

  /**
   * List projects with pagination and filters.
   */
  listProjects: async (query: TListProjectsQuery) => {
    const conditions: SQL[] = [];

    if (query.cursor)        conditions.push(gt(project.id, query.cursor));
    if (query.name)          conditions.push(ilike(project.name, `%${query.name}%`));
    if (query.projectType)   conditions.push(eq(project.projectType, query.projectType));
    if (query.projectStage)  conditions.push(eq(project.projectStage, query.projectStage));
    if (query.projectStatus) conditions.push(eq(project.projectStatus, query.projectStatus));
    if (query.region)        conditions.push(eq(project.region, query.region));
    if (query.country)       conditions.push(eq(project.country, query.country));

    const results = await db
      .select()
      .from(project)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(project.id))
      .limit(query.limit + 1);

    const hasNextPage = results.length > query.limit;
    const data        = hasNextPage ? results.slice(0, -1) : results;
    const nextCursor  = hasNextPage ? data[data.length - 1].id : null;

    return { data, nextCursor };
  },

  /**
   * Delete a project (cascade handles enrollments/plots/activities).
   */
  deleteProject: async (id: string) => {
    const [result] = await db
      .delete(project)
      .where(eq(project.id, id))
      .returning();

    if (!result) {
      throw new AppError(`Project with id ${id} not found`, 404);
    }
  },
};

export default ProjectService;
