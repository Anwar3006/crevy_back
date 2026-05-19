// src/v2/mrv/routes/mrv.route.ts
import { Router } from "express";
import { requireAuth, requirePermission } from "@/middleware/auth.middleware";
import validateInboundRequest from "@/middleware/validateInboundRequest.middleware";
import { requireMrvWebhookAuth } from "../middleware/mrv_webhook.middleware";
import {
  RegisterIngestionSchema,
  IngestionWebhookSchema,
  VerificationWebhookSchema,
  BlockchainWebhookSchema,
  GetIngestionByIdSchema,
  GetByProjectIdSchema,
  SimulateProjectSchema,
} from "../schemas/mrv.schema";
import MrvController from "../controllers/mrv.controller";
import MrvSimulationController from "../controllers/mrv_simulation.controller";

const mrvRouter = Router();

/**
 * ─── Permission model ─────────────────────────────────────────────────────────
 *
 *   mrv:manage — admin can register ingestions and read all MRV data
 *
 *   Webhook routes (/webhook/*) use requireMrvWebhookAuth instead of
 *   requireAuth — they are machine-to-machine calls from CraftedClimate,
 *   never associated with a user session.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Admin routes ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /mrv/ingestions:
 *   post:
 *     summary: Register a sensor deployment
 *     tags: [MRV]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ccIngestionId, projectId, plotId, projectOwnerId, partnerId]
 *             properties:
 *               ccIngestionId:
 *                 type: string
 *               projectId:
 *                 type: string
 *                 format: uuid
 *               plotId:
 *                 type: string
 *                 format: uuid
 *               projectOwnerId:
 *                 type: string
 *                 format: uuid
 *               partnerId:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Ingestion registered successfully
 *
 * /mrv/ingestions/{ccIngestionId}/status:
 *   get:
 *     summary: Get ingestion status
 *     tags: [MRV]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: ccIngestionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Ingestion status details
 *
 * /mrv/verifications/project/{projectId}:
 *   get:
 *     summary: Get project verifications
 *     tags: [MRV]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: List of project verification results
 */
mrvRouter.post(
  "/ingestions",
  requireAuth,
  requirePermission(["mrv", "manage"]),
  validateInboundRequest(RegisterIngestionSchema),
  MrvController.registerIngestion
);

mrvRouter.get(
  "/ingestions/:ccIngestionId/status",
  requireAuth,
  requirePermission(["mrv", "manage"]),
  validateInboundRequest(GetIngestionByIdSchema),
  MrvController.getIngestionStatus
);

mrvRouter.get(
  "/ingestions/project/:projectId",
  requireAuth,
  requirePermission(["mrv", "manage"]),
  validateInboundRequest(GetByProjectIdSchema),
  MrvController.getIngestionsByProject
);

// ─── CraftedClimate Webhook routes ────────────────────────────────────────────
/**
 * @swagger
 * /mrv/webhook/ingestion:
 *   post:
 *     summary: Ingestion webhook (CraftedClimate only)
 *     tags: [MRV - Webhooks]
 *     responses:
 *       204:
 *         description: Webhook processed
 * /mrv/webhook/verification:
 *   post:
 *     summary: Verification webhook (CraftedClimate only)
 *     tags: [MRV - Webhooks]
 *     responses:
 *       204:
 *         description: Webhook processed
 * /mrv/webhook/blockchain:
 *   post:
 *     summary: Blockchain webhook (CraftedClimate only)
 *     tags: [MRV - Webhooks]
 *     responses:
 *       204:
 *         description: Webhook processed
 */

mrvRouter.post(
  "/webhook/ingestion",
  requireMrvWebhookAuth,
  validateInboundRequest(IngestionWebhookSchema),
  MrvController.handleIngestionWebhook
);

mrvRouter.post(
  "/webhook/verification",
  requireMrvWebhookAuth,
  validateInboundRequest(VerificationWebhookSchema),
  MrvController.handleVerificationWebhook
);

mrvRouter.post(
  "/webhook/blockchain",
  requireMrvWebhookAuth,
  validateInboundRequest(BlockchainWebhookSchema),
  MrvController.handleBlockchainWebhook
);

// ─── Project-scoped read routes ───────────────────────────────────────────────

mrvRouter.get(
  "/verifications/project/:projectId",
  requireAuth,
  validateInboundRequest(GetByProjectIdSchema),
  MrvController.getVerificationsByProject
);

mrvRouter.get(
  "/anchors/project/:projectId",
  requireAuth,
  validateInboundRequest(GetByProjectIdSchema),
  MrvController.getAnchorsByProject
);

// ─── Demo Simulation Route ────────────────────────────────────────────────────
// Simulates the full CraftedClimate dMRV pipeline for a given project.
// Only available in non-production environments — enforced by the env guard.
// Requires auth because it modifies project stage.

mrvRouter.post(
  '/simulate/:projectId',
  requireAuth,
  validateInboundRequest(SimulateProjectSchema),
  MrvSimulationController.simulate,
)

export default mrvRouter;
