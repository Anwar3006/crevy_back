// src/v2/mrv/schemas/mrv.schema.ts
import { z } from "zod";

// ─── Register Ingestion ───────────────────────────────────────────────────────

/**
 * Admin registers a CraftedClimate sensor deployment against a Crevy plot.
 * This creates the translation record between CraftedClimate's device/ingestion
 * namespace and Crevy's project/plot/owner IDs.
 */
export const RegisterIngestionSchema = z.object({
  body: z.object({
    ccIngestionId:   z.string().min(1,  "CraftedClimate ingestion ID is required"),
    projectId:       z.string().uuid("projectId must be a valid UUID"),
    plotId:          z.string().uuid("plotId must be a valid UUID"),
    projectOwnerId:  z.string().uuid("projectOwnerId must be a valid UUID"),
    partnerId:       z.number({ error: "partnerId must be a number" }).int().positive(),
    deviceId:        z.string().min(1).optional(),
  }),
});

// ─── CraftedClimate Telemetry — Ingestion Webhook ───────────────────────────

/**
 * Payload delivered by CraftedClimate when they receive the first telemetry
 * packet from a sensor. This automatically registers the ingestion in Crevy.
 */
export const IngestionWebhookSchema = z.object({
  body: z.object({
    cc_ingestion_id: z.string().min(1, "cc_ingestion_id is required"),
    device_id:       z.string().min(1, "device_id is required"),
    project_code:    z.string().min(1, "project_code is required"),
    timestamp:       z.string().datetime(),
  }),
});

// ─── CraftedClimate Worker 2 — Verification Webhook ─────────────────────────

/**
 * Payload delivered by CraftedClimate after their ML model evaluates a
 * sensor reading batch. Stored verbatim in mrv_verification_result.
 *
 * CONSERVATISM PRINCIPLE (from CraftedClimate spec):
 *   Always use net_credits_issued for any credit-issuance logic.
 *   Never use gross_removals_tco2e — it has not had leakage or buffer deducted.
 *   When verification_status is FLAGGED all carbon_accounting fields are null.
 */
export const VerificationWebhookSchema = z.object({
  body: z.object({
    cc_ingestion_id:       z.string().min(1, "cc_ingestion_id is required"),
    verification_event_id: z.string().min(1, "verification_event_id is required"),
    methodology_applied:   z.string().optional(),
    verification_status:   z.enum(["SUCCESS", "FLAGGED", "FAILED"]),
    ai_inference_results: z.object({
      model_id:         z.string(),
      confidence_score: z.number().min(0).max(1),
      is_anomalous:     z.boolean(),
      prediction_class: z.string(),
    }),
    carbon_accounting: z.object({
      gross_removals_tCO2e: z.number().nullable(),
      leakage_deduction:    z.number().nullable(),
      buffer_contribution:  z.number().nullable(),
      net_credits_issued:   z.number().nullable(), // ← authoritative issuance figure
    }),
    validation_checks: z.object({
      geo_fence_status:   z.enum(["VALID", "INVALID"]),
      hardware_integrity: z.enum(["SECURE", "COMPROMISED"]),
    }),
  }),
});

// ─── CraftedClimate Worker 3 — Blockchain Anchor Webhook ─────────────────────

/**
 * Payload delivered after CraftedClimate anchors the verified batch to Polygon.
 * transaction_hash + audit_uri are the public proof of credit authenticity —
 * an auditor can verify both without trusting Crevy.
 * Credits are issued when THIS webhook arrives, not on Worker 2.
 */
export const BlockchainWebhookSchema = z.object({
  body: z.object({
    verification_event_id: z.string().min(1, "verification_event_id is required"),
    blockchain_anchor: z.object({
      network:          z.string(),
      contract_address: z.string(),
      transaction_hash: z.string(),
      block_height:     z.number().int().positive(),
    }),
    on_chain_metadata: z.object({
      project_id:  z.string(),
      vintage:     z.string().regex(/^\d{4}$/, "vintage must be a 4-digit year"),
      batch_id:    z.string(),
      merkle_root: z.string(),
      audit_uri:   z.string().min(1),
    }),
  }),
});

// ─── Query Schemas ────────────────────────────────────────────────────────────

export const GetIngestionByIdSchema = z.object({
  params: z.object({
    ccIngestionId: z.string().min(1),
  }),
});

export const GetByProjectIdSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("projectId must be a valid UUID"),
  }),
});

// ─── Inferred Types ───────────────────────────────────────────────────────────

/**
 * @swagger
 * components:
 *   schemas:
 *     MRVIngestion:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         ccIngestionId:
 *           type: string
 *         projectId:
 *           type: string
 *           format: uuid
 *         plotId:
 *           type: string
 *           format: uuid
 *         projectOwnerId:
 *           type: string
 *           format: uuid
 *         partnerId:
 *           type: integer
 *         deviceId:
 *           type: string
 *         status:
 *           type: string
 *           enum: [PENDING, ACTIVE, INACTIVE, DEPLOYED]
 *         registeredAt:
 *           type: string
 *           format: date-time
 *     MRVVerification:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         ccIngestionId:
 *           type: string
 *         verificationEventId:
 *           type: string
 *         verificationStatus:
 *           type: string
 *           enum: [SUCCESS, FLAGGED, FAILED]
 *         netCreditsIssued:
 *           type: number
 *         isAnchored:
 *           type: boolean
 *         anchoredAt:
 *           type: string
 *           format: date-time
 */

export type TRegisterIngestion       = z.infer<typeof RegisterIngestionSchema>;
export type TIngestionWebhook         = z.infer<typeof IngestionWebhookSchema>;
export type TVerificationWebhook     = z.infer<typeof VerificationWebhookSchema>;
export type TBlockchainWebhook       = z.infer<typeof BlockchainWebhookSchema>;

// ─── Demo Simulation Schema ──────────────────────────────────────────────────

export const SimulateProjectSchema = z.object({
  params: z.object({
    projectId: z.string().uuid('projectId must be a valid UUID'),
  }),
})

export type TSimulateProject = z.infer<typeof SimulateProjectSchema>;
