// src/v2/project_owners/services/project_owner_assignment.service.ts
import { db } from '@/config/db';
import { projectOwnerAssignment } from '../models/project_owner_assignment.model';
import { and, asc, eq, gt, SQL } from 'drizzle-orm';
import AppError from '@/shared/errors/AppError';
import {
  TCreateProjectOwnerAssignment,
  TListProjectOwnerAssignmentsQuery,
  TUpdateProjectOwnerAssignment,
} from '../schemas/project_owner_assignment.schema';

const ProjectOwnerAssignmentService = {

  /**
   * Create a new assignment.
   *
   * Business rules (enforced here):
   *  - An active PRIMARY assignment must be unique per project_owner.
   *    If one already exists, 409 is thrown — the caller must deactivate it first.
   *  - B2C assignments must NOT have a partnerId.
   *  - B2B assignments (isB2cAssignment = false) MUST have a partnerId.
   */
  createAssignment: async (payload: {
    body:       TCreateProjectOwnerAssignment['body'];
    assignedBy: string;
  }) => {
    const { body, assignedBy } = payload;

    // Guard: B2C ↔ partner consistency
    if (body.isB2cAssignment && body.partnerId != null) {
      throw new AppError(
        'A B2C assignment must not have a partnerId',
        400,
      );
    }
    if (!body.isB2cAssignment && body.partnerId == null) {
      throw new AppError(
        'A B2B assignment (isB2cAssignment = false) must include a partnerId',
        400,
      );
    }

    // Guard: only one active PRIMARY per project_owner
    if (body.assignmentType === 'primary') {
      const existing = await ProjectOwnerAssignmentService.getActivePrimaryAssignment(
        body.projectOwnerId,
      );
      if (existing) {
        throw new AppError(
          'This project owner already has an active primary assignment. Deactivate it first.',
          409,
        );
      }
    }

    const [result] = await db
      .insert(projectOwnerAssignment)
      .values({
        projectOwnerId:  body.projectOwnerId,
        agentId:         body.agentId,
        assignedBy,
        partnerId:       body.partnerId ?? null,
        assignmentType:  body.assignmentType as 'primary' | 'secondary',
        isB2cAssignment: body.isB2cAssignment,
        isActive:        true,
      })
      .returning();

    return result;
  },

  /**
   * Update an existing assignment (partial).
   */
  updateAssignment: async ({
    params,
    body,
  }: {
    params: TUpdateProjectOwnerAssignment['params'];
    body:   TUpdateProjectOwnerAssignment['body'];
  }) => {
    const existing = await ProjectOwnerAssignmentService.getAssignmentById(params.id);

    // If promoting to primary, ensure no other active primary exists
    if (
      body.assignmentType === 'primary' &&
      existing.assignmentType !== 'primary'
    ) {
      const activePrimary = await ProjectOwnerAssignmentService.getActivePrimaryAssignment(
        existing.projectOwnerId,
      );
      if (activePrimary && activePrimary.id !== params.id) {
        throw new AppError(
          'An active primary assignment already exists for this project owner. Deactivate it first.',
          409,
        );
      }
    }

    const [result] = await db
      .update(projectOwnerAssignment)
      .set({
        ...body,
        assignmentType: body.assignmentType as 'primary' | 'secondary' | undefined,
      })
      .where(eq(projectOwnerAssignment.id, params.id))
      .returning();

    return result;
  },

  /**
   * Fetch a single assignment by its PK.
   */
  getAssignmentById: async (id: string) => {
    const [result] = await db
      .select()
      .from(projectOwnerAssignment)
      .where(eq(projectOwnerAssignment.id, id));

    if (!result) {
      throw new AppError(`Assignment with id ${id} not found`, 404);
    }

    return result;
  },

  /**
   * Cursor-paginated list with optional filters.
   */
  listAssignments: async (query: TListProjectOwnerAssignmentsQuery) => {
    const conditions: SQL[] = [];

    if (query.cursor)         conditions.push(gt(projectOwnerAssignment.id, query.cursor));
    if (query.projectOwnerId) conditions.push(eq(projectOwnerAssignment.projectOwnerId, query.projectOwnerId));
    if (query.agentId)        conditions.push(eq(projectOwnerAssignment.agentId, query.agentId));
    if (query.assignmentType) conditions.push(eq(projectOwnerAssignment.assignmentType, query.assignmentType as 'primary' | 'secondary'));
    if (query.isActive != null) conditions.push(eq(projectOwnerAssignment.isActive, query.isActive));
    if (query.partnerId)      conditions.push(eq(projectOwnerAssignment.partnerId, query.partnerId));

    const results = await db
      .select()
      .from(projectOwnerAssignment)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(projectOwnerAssignment.id))
      .limit(query.limit + 1);

    const hasNextPage = results.length > query.limit;
    const data        = hasNextPage ? results.slice(0, -1) : results;
    const nextCursor  = hasNextPage ? data[data.length - 1].id : null;

    return { data, nextCursor };
  },

  /**
   * Hard-delete an assignment row.
   * Prefer toggling isActive = false in production; delete only via admin.
   */
  deleteAssignment: async (id: string) => {
    await ProjectOwnerAssignmentService.getAssignmentById(id); // throws 404 if missing
    await db
      .delete(projectOwnerAssignment)
      .where(eq(projectOwnerAssignment.id, id));
  },

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /**
   * Returns the single active primary assignment for a project_owner, or null.
   */
  getActivePrimaryAssignment: async (projectOwnerId: string) => {
    const [row] = await db
      .select()
      .from(projectOwnerAssignment)
      .where(
        and(
          eq(projectOwnerAssignment.projectOwnerId, projectOwnerId),
          eq(projectOwnerAssignment.assignmentType, 'primary'),
          eq(projectOwnerAssignment.isActive, true),
        ),
      );
    return row ?? null;
  },
};

export default ProjectOwnerAssignmentService;
