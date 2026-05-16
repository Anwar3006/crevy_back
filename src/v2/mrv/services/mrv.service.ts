// src/v2/mrv/services/mrv.service.ts
import { db } from "@/config/db";
import { eq, and } from "drizzle-orm";
import { mrvIngestionEvent, mrvIngestionStatusEnum } from "../models/mrv_ingestion.model";
import { mrvVerificationResult, verificationStatusEnum } from "../models/mrv_verification.model";
import { mrvBlockchainAnchor } from "../models/mrv_blockchain.model";
import { farmPlot, partner, project, projectOwner } from "@/v2/parent-model";
import AppError from "@/shared/errors/AppError";
import {
  TRegisterIngestion,
  TIngestionWebhook,
  TVerificationWebhook,
  TBlockchainWebhook,
} from "../schemas/mrv.schema";
import NotificationService from "@/v2/notifications/services/notification.service";
import { projectOwnerAssignment } from "@/v2/project_owners/models/project_owner_assignment.model";
import CreditService from "@/v2/credits/services/credit.service";

const MrvService = {

  // ─── Register Ingestion ───────────────────────────────────────────────────

  /**
   * Admin registers a CraftedClimate sensor deployment.
   * Validates all FK targets exist and that the plot is ready for dMRV
   * (boundary must be verified — buffered_centroid plots are rejected).
   */
  registerIngestion: async (body: TRegisterIngestion["body"]) => {
    const { ccIngestionId, projectId, plotId, projectOwnerId, partnerId, deviceId } = body;

    // 1. No duplicate ccIngestionId
    const [duplicate] = await db
      .select({ id: mrvIngestionEvent.id })
      .from(mrvIngestionEvent)
      .where(eq(mrvIngestionEvent.ccIngestionId, ccIngestionId));
    if (duplicate) {
      throw new AppError(`Ingestion event with cc_ingestion_id "${ccIngestionId}" already exists`, 409);
    }

    // 2. Partner must exist and be approved
    const [partnerRow] = await db
      .select({ id: partner.id, status: partner.status })
      .from(partner)
      .where(eq(partner.id, partnerId));
    if (!partnerRow) {
      throw new AppError(`Partner with id ${partnerId} not found`, 404);
    }
    if (partnerRow.status !== "approved") {
      throw new AppError(
        `Partner with id ${partnerId} is not approved. Current status: "${partnerRow.status}"`,
        400
      );
    }

    // 3. Project must exist
    const [projectRow] = await db
      .select({ id: project.id })
      .from(project)
      .where(eq(project.id, projectId));
    if (!projectRow) {
      throw new AppError(`Project with id ${projectId} not found`, 404);
    }

    // 4. ProjectOwner must exist
    const [ownerRow] = await db
      .select({ id: projectOwner.id })
      .from(projectOwner)
      .where(eq(projectOwner.id, projectOwnerId));
    if (!ownerRow) {
      throw new AppError(`Project owner with id ${projectOwnerId} not found`, 404);
    }

    // 5. Farm plot must exist and have a verified boundary
    //    Plots with boundary_collection_method = 'buffered_centroid' are not
    //    accurate enough for CraftedClimate's geo-fence validation.
    const [plotRow] = await db
      .select({
        id: farmPlot.id,
        boundaryVerified: farmPlot.boundaryVerified,
        boundaryCollectionMethod: farmPlot.boundaryCollectionMethod,
      })
      .from(farmPlot)
      .where(eq(farmPlot.id, plotId));

    if (!plotRow) {
      throw new AppError(`Farm plot with id ${plotId} not found`, 404);
    }
    if (!plotRow.boundaryVerified) {
      throw new AppError(
        "Farm plot boundary has not been verified. Verify the boundary before submitting for dMRV.",
        400
      );
    }
    if (plotRow.boundaryCollectionMethod === "buffered_centroid") {
      throw new AppError(
        "Farm plot uses a buffered centroid boundary — accuracy is too low for dMRV submission. " +
        "Collect a proper GPS boundary (walked_gps, drawn_mobile, drawn_web, or satellite_derived).",
        400
      );
    }

    // 6. Insert the ingestion event
    const [event] = await db
      .insert(mrvIngestionEvent)
      .values({
        ccIngestionId,
        projectId,
        plotId,
        projectOwnerId,
        partnerId,
        deviceId:            deviceId ?? null,
        submissionTimestamp: new Date(),
        ingestionStatus:     "pending",
      })
      .returning();

    return event;
  },

  // ─── Telemetry / Ingestion Webhook (CraftedClimate Initial Hit) ───────────

  /**
   * Receives CraftedClimate's telemetry start event and automatically registers
   * the ingestion in Crevy. This removes the need for manual admin entry.
   */
  handleIngestionWebhook: async (payload: TIngestionWebhook["body"]) => {
    const { cc_ingestion_id, device_id, project_code } = payload;

    // 1. Resolve Farm Plot by device_id
    const [plot] = await db
      .select()
      .from(farmPlot)
      .where(eq(farmPlot.deviceId, device_id));

    if (!plot) {
      throw new AppError(`No farm plot found for device_id "${device_id}"`, 404);
    }

    // 2. Resolve Project by code
    const [projectRow] = await db
      .select()
      .from(project)
      .where(eq(project.code, project_code));

    if (!projectRow) {
      throw new AppError(`No project found for code "${project_code}"`, 404);
    }

    // 3. Resolve Partner (CraftedClimate is the dMRV provider)
    const [dmrvPartner] = await db
      .select()
      .from(partner)
      .where(eq(partner.partnerType, "dMRV_provider"));

    if (!dmrvPartner) {
      throw new AppError("No dMRV provider partner record found in Crevy", 500);
    }

    // 4. Resolve assigned Agent for notification
    const [assignment] = await db
      .select()
      .from(projectOwnerAssignment)
      .where(
        and(
          eq(projectOwnerAssignment.projectOwnerId, plot.projectOwnerId),
          eq(projectOwnerAssignment.isActive, true)
        )
      );

    // 5. Insert Ingestion Event
    const [event] = await db
      .insert(mrvIngestionEvent)
      .values({
        ccIngestionId: cc_ingestion_id,
        projectId:     projectRow.id,
        plotId:        plot.id,
        projectOwnerId: plot.projectOwnerId,
        partnerId:     dmrvPartner.id,
        deviceId:      device_id,
        submissionTimestamp: new Date(payload.timestamp),
        ingestionStatus: "pending",
      })
      .onConflictDoNothing({ target: mrvIngestionEvent.ccIngestionId })
      .returning();

    if (!event) {
      return { success: true, message: "Duplicate ingestion hit ignored" };
    }

    // 6. Notify Agent
    if (assignment?.agentId) {
      await NotificationService.create({
        userIds: [assignment.agentId],
        title: "New Ingestion Started",
        content: `dMRV telemetry received for Plot ID ${plot.id.slice(0, 8)}...`,
        type: "mrv",
        priority: "low",
        metadata: { cc_ingestion_id, plot_id: plot.id },
        actionUrl: `/dashboard/mrv/ingestions/${cc_ingestion_id}`,
      });
    }

    return event;
  },

  // ─── Verification Webhook (CraftedClimate Worker 2) ───────────────────────

  /**
   * Receives CraftedClimate's verification result and persists it.
   *
   * Status mapping (CraftedClimate sends uppercase, DB stores lowercase):
   *   SUCCESS → 'verified'  — credits will be issued when the blockchain anchor arrives
   *   FLAGGED → 'flagged'   — carbon fields are null; admin must investigate sensor
   *   FAILED  → 'failed'    — data rejected; no credits issued
   *
   * Credits are NOT issued here. We wait for Worker 3 (blockchain anchor) to
   * arrive before issuing credits so every credit row has a tx_hash.
   */
  handleVerificationWebhook: async (payload: TVerificationWebhook["body"]) => {
    // 1. Locate the ingestion event this result belongs to
    const [ingestion] = await db
      .select()
      .from(mrvIngestionEvent)
      .where(eq(mrvIngestionEvent.ccIngestionId, payload.cc_ingestion_id));

    if (!ingestion) {
      throw new AppError(
        `No ingestion event found for cc_ingestion_id "${payload.cc_ingestion_id}"`,
        404
      );
    }

    // 2. Normalise status to lowercase DB enum value
    const statusMap: Record<string, typeof verificationStatusEnum.enumValues[number]> = {
      SUCCESS: "success",
      FLAGGED: "flagged",
      FAILED:  "failed",
    };
    const verificationStatus = statusMap[payload.verification_status];

    // 3. Persist the verification result
    const [result] = await db
      .insert(mrvVerificationResult)
      .values({
        ingestionId:         ingestion.id,
        projectId:           ingestion.projectId,
        verificationEventId: payload.verification_event_id,
        methodologyApplied:  payload.methodology_applied ?? null,
        verificationStatus,
        aiModelId:           payload.ai_inference_results.model_id,
        aiConfidenceScore:   payload.ai_inference_results.confidence_score.toString(),
        isAnomalous:         payload.ai_inference_results.is_anomalous,
        predictionClass:     payload.ai_inference_results.prediction_class,
        geoFenceStatus:      payload.validation_checks.geo_fence_status.toLowerCase() as "valid" | "invalid",
        hardwareIntegrity:   payload.validation_checks.hardware_integrity.toLowerCase(),
        // Carbon accounting fields are null when FLAGGED
        grossRemovalsTco2e:  payload.carbon_accounting.gross_removals_tCO2e?.toString() ?? null,
        leakageDeduction:    payload.carbon_accounting.leakage_deduction?.toString()    ?? null,
        bufferContribution:  payload.carbon_accounting.buffer_contribution?.toString()  ?? null,
        netCreditsIssued:    payload.carbon_accounting.net_credits_issued?.toString()   ?? null,
        receivedAt:          new Date(),
      })
      .returning();

    // 4. Update ingestion event status
    const ingestionStatusMap: Record<string, typeof mrvIngestionStatusEnum.enumValues[number]> = {
      success: "verified",
      flagged: "flagged",
      failed:  "failed",
    };
    await db
      .update(mrvIngestionEvent)
      .set({ ingestionStatus: ingestionStatusMap[verificationStatus] })
      .where(eq(mrvIngestionEvent.id, ingestion.id));

    // 5. Notify the assigned agent
    const [assignment] = await db
      .select()
      .from(projectOwnerAssignment)
      .where(
        and(
          eq(projectOwnerAssignment.projectOwnerId, ingestion.projectOwnerId),
          eq(projectOwnerAssignment.isActive, true)
        )
      );

    if (assignment?.agentId) {
      await NotificationService.create({
        userIds: [assignment.agentId],
        title: `Verification ${payload.verification_status}`,
        content: `Ingestion ${payload.cc_ingestion_id} evaluated with status: ${payload.verification_status}`,
        type: "mrv",
        priority: verificationStatus === "success" ? "medium" : "high",
        metadata: {
          cc_ingestion_id: payload.cc_ingestion_id,
          verification_status: payload.verification_status,
          confidence: payload.ai_inference_results.confidence_score
        },
        actionUrl: `/dashboard/mrv/verifications/${result.id}`,
      });
    }

    // 6. If FLAGGED: log for admin investigation
    //    TODO: Create notification row for admin and project owner when
    //    notifications module is built.
    if (verificationStatus === "flagged") {
      console.warn(
        `[MRV] Ingestion ${ingestion.ccIngestionId} flagged. ` +
        `Confidence: ${payload.ai_inference_results.confidence_score}. ` +
        `Anomalous: ${payload.ai_inference_results.is_anomalous}.`
      );
    }

    return { result, creditsIssued: 0 };
  },

  // ─── Blockchain Anchor Webhook (CraftedClimate Worker 3) ─────────────────

  /**
   * Receives CraftedClimate's Polygon anchor and triggers credit issuance.
   *
   * Worker 3 only fires after Worker 2 SUCCESS — so we assert that the
   * matching verification result exists and has status 'success'.
   *
   * Credit issuance:
   *   Uses net_credits_issued from the linked mrv_verification_result.
   *   Never use gross_removals_tco2e for issuance.
   */
  handleBlockchainWebhook: async (payload: TBlockchainWebhook["body"]) => {
    // 1. Find the verification result this anchor corresponds to
    const [verificationResult] = await db
      .select()
      .from(mrvVerificationResult)
      .where(
        eq(mrvVerificationResult.verificationEventId, payload.verification_event_id)
      );

    if (!verificationResult) {
      throw new AppError(
        `No verification result found for verification_event_id "${payload.verification_event_id}"`,
        404
      );
    }

    // 2. Refuse to anchor a non-SUCCESS verification
    if (verificationResult.verificationStatus !== "success") {
      throw new AppError(
        `Cannot create blockchain anchor for a verification with status "${verificationResult.verificationStatus}". ` +
        `Only SUCCESS verifications can be anchored.`,
        400
      );
    }

    // 3. Prevent duplicate anchors (unique constraint on result_id and transaction_hash)
    const [existing] = await db
      .select({ id: mrvBlockchainAnchor.id })
      .from(mrvBlockchainAnchor)
      .where(eq(mrvBlockchainAnchor.resultId, verificationResult.id));

    if (existing) {
      throw new AppError(
        `A blockchain anchor already exists for this verification result`,
        409
      );
    }

    // 4. Insert the blockchain anchor
    const [anchor] = await db
      .insert(mrvBlockchainAnchor)
      .values({
        resultId:        verificationResult.id,
        projectId:       verificationResult.projectId,
        network:         payload.blockchain_anchor.network,
        contractAddress: payload.blockchain_anchor.contract_address,
        transactionHash: payload.blockchain_anchor.transaction_hash,
        blockHeight:     payload.blockchain_anchor.block_height,
        batchId:         payload.on_chain_metadata.batch_id,
        vintage:         parseInt(payload.on_chain_metadata.vintage, 10),
        merkleRoot:      payload.on_chain_metadata.merkle_root,
        auditUri:        payload.on_chain_metadata.audit_uri,
        anchoredAt:      new Date(),
      })
      .returning();

    const credit = await CreditService.issueCredits({
      projectId:         verificationResult.projectId,
      netCreditsIssued:  parseFloat(verificationResult.netCreditsIssued!),
      batchId:           anchor.batchId,
      vintage:           anchor.vintage,
      blockchainTxHash:  anchor.transactionHash,
    });
    const creditsIssued = Number(credit.totalAmount);

    // 6. Notify the assigned agent
    const [ingestion] = await db
      .select({ projectOwnerId: mrvIngestionEvent.projectOwnerId })
      .from(mrvIngestionEvent)
      .innerJoin(mrvVerificationResult, eq(mrvIngestionEvent.id, mrvVerificationResult.ingestionId))
      .where(eq(mrvVerificationResult.id, verificationResult.id));

    const [assignment] = await db
      .select()
      .from(projectOwnerAssignment)
      .where(
        and(
          eq(projectOwnerAssignment.projectOwnerId, ingestion.projectOwnerId),
          eq(projectOwnerAssignment.isActive, true)
        )
      );

    if (assignment?.agentId) {
      await NotificationService.create({
        userIds: [assignment.agentId],
        title: "Blockchain Anchor Finalized",
        content: `Credits anchored to Polygon for batch ${payload.on_chain_metadata.batch_id}`,
        type: "mrv",
        priority: "medium",
        metadata: {
          batch_id: payload.on_chain_metadata.batch_id,
          tx_hash: payload.blockchain_anchor.transaction_hash
        },
        actionUrl: `/dashboard/mrv/anchors/${anchor.id}`,
      });
    }

    return { anchor, creditsIssued };
  },

  // ─── Read Operations ──────────────────────────────────────────────────────

  getIngestionStatus: async (ccIngestionId: string) => {
    const [event] = await db
      .select()
      .from(mrvIngestionEvent)
      .where(eq(mrvIngestionEvent.ccIngestionId, ccIngestionId));

    if (!event) {
      throw new AppError(
        `Ingestion event with cc_ingestion_id "${ccIngestionId}" not found`,
        404
      );
    }

    return event;
  },

  getIngestionsByProject: async (projectId: string) => {
    return db
      .select()
      .from(mrvIngestionEvent)
      .where(eq(mrvIngestionEvent.projectId, projectId));
  },

  getVerificationsByProject: async (projectId: string) => {
    return db
      .select()
      .from(mrvVerificationResult)
      .where(eq(mrvVerificationResult.projectId, projectId));
  },

  getAnchorsByProject: async (projectId: string) => {
    return db
      .select()
      .from(mrvBlockchainAnchor)
      .where(eq(mrvBlockchainAnchor.projectId, projectId));
  },
};

export default MrvService;
