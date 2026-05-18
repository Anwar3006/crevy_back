// src/v2/projects/services/project.service.ts
import { db } from '@/config/db';
import { project } from '../models/project.model';
import { and, asc, eq, gt, ilike, SQL } from 'drizzle-orm';
import AppError from '@/shared/errors/AppError';
import { TCreateProject, TListProjectsQuery, TUpdateProject } from '../schemas/project.schema';

const ProjectService = {

  createProject: async (payload: { body: TCreateProject['body']; createdBy: string }) => {
    const { body, createdBy } = payload;
    const year = new Date().getFullYear();

    // Generate code: PRJ-GH-2026-001
    const existing = await db
      .select({ id: project.id })
      .from(project)
      .where(and(eq(project.country, body.country), ilike(project.code, `%-${year}-%`)));

    const sequence = (existing.length + 1).toString().padStart(3, '0');
    const code = `PRJ-${body.country.toUpperCase()}-${year}-${sequence}`;

    const [result] = await db
      .insert(project)
      .values({
        code,
        name:              body.name,
        projectType:       body.projectType,
        sector:            body.sector ?? 'green_economy',
        projectTags:       body.projectTags ?? [],
        description:       body.description ?? null,
        sdgs:              body.sdgs ?? [],
        region:            body.region,
        country:           body.country,
        gpsCoordinates:    body.gpsCoordinates ?? null,
        totalAreaHectares: body.totalAreaHectares?.toString() ?? null,
        startDate:         body.startDate,
        endDate:           body.endDate ?? null,
        currencyId:        body.currencyId,
        createdBy,
      })
      .returning();

    return result;
  },

  updateProject: async (payload: { params: TUpdateProject['params']; body: TUpdateProject['body'] }) => {
    const { params, body } = payload;

    const [result] = await db
      .update(project)
      .set(body)
      .where(eq(project.id, params.id))
      .returning();

    if (!result) throw new AppError(`Project with id ${params.id} not found`, 404);
    return result;
  },

  getProjectById: async (id: string) => {
    const [result] = await db.select().from(project).where(eq(project.id, id));
    if (!result) throw new AppError(`Project with id ${id} not found`, 404);
    return result;
  },

  listProjects: async (query: TListProjectsQuery) => {
    const conditions: SQL[] = [];

    if (query.cursor)        conditions.push(gt(project.id, query.cursor));
    if (query.name)          conditions.push(ilike(project.name!, `%${query.name}%`));
    if (query.projectType)   conditions.push(eq(project.projectType, query.projectType));
    if (query.projectStage)  conditions.push(eq(project.projectStage, query.projectStage));
    if (query.projectStatus) conditions.push(eq(project.projectStatus, query.projectStatus));
    if (query.region)        conditions.push(ilike(project.region, `%${query.region}%`));
    if (query.country)       conditions.push(eq(project.country, query.country));
    if (query.createdBy)     conditions.push(eq(project.createdBy, query.createdBy));

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

  deleteProject: async (id: string) => {
    const [result] = await db.delete(project).where(eq(project.id, id)).returning();
    if (!result) throw new AppError(`Project with id ${id} not found`, 404);
  },
};

export default ProjectService;
