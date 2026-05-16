// src/v2/projects/routes/project.route.ts
import { Router } from 'express';
import ProjectController from '../controllers/project.controller';
import ProjectEnrollmentController from '../controllers/project_enrollment.controller';
import ProjectPlotController from '../controllers/project_plot.controller';
import ProjectActivityController from '../controllers/project_activity.controller';
import ProjectDocumentController from '../controllers/project_document.controller';


import { CreateProjectSchema, UpdateProjectSchema, ListProjectsQuerySchema } from '../schemas/project.schema';
import { EnrollProjectOwnerSchema, UpdateEnrollmentSchema, ListEnrollmentsQuerySchema } from '../schemas/project_enrollment.schema';
import { EnrollPlotSchema, UpdateProjectPlotSchema, ListProjectPlotsQuerySchema } from '../schemas/project_plot.schema';
import { CreateProjectActivitySchema, UpdateProjectActivitySchema, ListProjectActivitiesQuerySchema } from '../schemas/project_activity.schema';
import { CreateProjectDocumentSchema, ListProjectDocumentsSchema, VerifyProjectDocumentSchema, DeleteProjectDocumentSchema } from '../schemas/project_document.schema';
import { requireAuth, requirePermission } from '@/middleware/auth.middleware';
import validateInboundRequest from '@/middleware/validateInboundRequest.middleware';

const router = Router();

/**
 * @swagger
 * /projects:
 *   post:
 *     summary: Create a new project
 *     tags: [Projects]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateProject'
 *     responses:
 *       201:
 *         description: Project created successfully
 *       403:
 *         description: Forbidden - Admin only
 *   get:
 *     summary: List projects with pagination
 *     tags: [Projects]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: A list of projects
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Project'
 *                 nextCursor:
 *                   type: string
 */
router.post(
  '/',
  requireAuth,
  validateInboundRequest(CreateProjectSchema),
  ProjectController.createProject
);

router.get(
  '/',
  requireAuth,
  validateInboundRequest(ListProjectsQuerySchema),
  ProjectController.listProjects
);

router.get('/:id', requireAuth, ProjectController.getProjectById);

router.put(
  '/:id',
  requireAuth,
  validateInboundRequest(UpdateProjectSchema),
  ProjectController.updateProject
);

router.delete('/:id', requireAuth, ProjectController.deleteProject);

// ── Enrollments ──────────────────────────────────────────────────────────────
router.post(
  '/enrollments',
  requireAuth,
  validateInboundRequest(EnrollProjectOwnerSchema),
  ProjectEnrollmentController.enrollProjectOwner
);

router.get(
  '/enrollments',
  requireAuth,
  validateInboundRequest(ListEnrollmentsQuerySchema),
  ProjectEnrollmentController.listEnrollments
);

router.get('/enrollments/:id', requireAuth, ProjectEnrollmentController.getEnrollmentById);

router.put(
  '/enrollments/:id',
  requireAuth,
  validateInboundRequest(UpdateEnrollmentSchema),
  ProjectEnrollmentController.updateEnrollment
);

router.delete('/enrollments/:id', requireAuth, ProjectEnrollmentController.deleteEnrollment);

// ── Plots ────────────────────────────────────────────────────────────────────
router.post(
  '/plots',
  requireAuth,
  validateInboundRequest(EnrollPlotSchema),
  ProjectPlotController.enrollPlot
);

router.get(
  '/plots',
  requireAuth,
  validateInboundRequest(ListProjectPlotsQuerySchema),
  ProjectPlotController.listProjectPlots
);

router.get('/plots/:id', requireAuth, ProjectPlotController.getProjectPlotById);

router.put(
  '/plots/:id',
  requireAuth,
  validateInboundRequest(UpdateProjectPlotSchema),
  ProjectPlotController.updateProjectPlot
);

router.delete('/plots/:id', requireAuth, ProjectPlotController.deleteProjectPlot);

// ── Activities ───────────────────────────────────────────────────────────────
router.post(
  '/activities',
  requireAuth,
  validateInboundRequest(CreateProjectActivitySchema),
  ProjectActivityController.createActivity
);

router.get(
  '/activities',
  requireAuth,
  validateInboundRequest(ListProjectActivitiesQuerySchema),
  ProjectActivityController.listActivities
);

router.get('/activities/:id', requireAuth, ProjectActivityController.getActivityById);

router.put(
  '/activities/:id',
  requireAuth,
  validateInboundRequest(UpdateProjectActivitySchema),
  ProjectActivityController.updateActivity
);

router.delete('/activities/:id', requireAuth, ProjectActivityController.deleteActivity);

/**
 * @swagger
 * /projects/{id}/documents:
 *   post:
 *     summary: Upload a project document (metadata)
 *     tags: [Project Documents]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [documentType, fileName, fileUrl, fileSize]
 *             properties:
 *               documentType:
 *                 type: string
 *                 enum: [land_ownership, community_consent, site_access_authorization, national_id, site_photos]
 *               fileName:
 *                 type: string
 *               fileUrl:
 *                 type: string
 *                 format: uri
 *               fileSize:
 *                 type: integer
 *               mimeType:
 *                 type: string
 *     responses:
 *       201:
 *         description: Document metadata stored successfully
 *   get:
 *     summary: List all documents for a project
 *     tags: [Project Documents]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: A list of project documents
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ProjectDocument'
 *
 * /projects/{id}/documents/{docId}/verify:
 *   patch:
 *     summary: Admin marks a document as verified
 *     tags: [Project Documents]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: docId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Document verified successfully
 *       403:
 *         description: Forbidden - Admin only
 *
 * /projects/{id}/documents/{docId}:
 *   delete:
 *     summary: Delete a project document
 *     tags: [Project Documents]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: docId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Document deleted successfully
 */
router.post(
  '/:id/documents',
  requireAuth,
  validateInboundRequest(CreateProjectDocumentSchema),
  ProjectDocumentController.uploadDocument
);

router.get(
  '/:id/documents',
  requireAuth,
  validateInboundRequest(ListProjectDocumentsSchema),
  ProjectDocumentController.listDocuments
);

router.patch(
  '/:id/documents/:docId/verify',
  requireAuth,
  requirePermission(['project_documents', 'manage']), // Admin only
  validateInboundRequest(VerifyProjectDocumentSchema),
  ProjectDocumentController.verifyDocument
);

router.delete(
  '/:id/documents/:docId',
  requireAuth,
  validateInboundRequest(DeleteProjectDocumentSchema),
  ProjectDocumentController.deleteDocument
);

export default router;
