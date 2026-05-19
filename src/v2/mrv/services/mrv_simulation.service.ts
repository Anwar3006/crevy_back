import { db } from '@/config/db'
import {
  project,
  projectOwner,
  farmPlot,
  partner,
  mrvIngestionEvent,
  mrvVerificationResult,
  mrvBlockchainAnchor,
  projectOwnerEnrollment
} from '@/v2/parent-model'
import AppError from '@/shared/errors/AppError'
import { eq, sql, and } from 'drizzle-orm'
import { uuidv7PK } from '@/shared/utils/id'

export class MrvSimulationService {
  static async simulateFullMrvPipeline(projectId: string) {
    // Step 1 — Load the project
    const [existingProject] = await db.select().from(project).where(eq(project.id, projectId))
    if (!existingProject) {
      throw new AppError('Project not found', 404)
    }

    // Step 2 — Resolve the project owner
    // First try to find an enrolled project owner
    const [enrollment] = await db.select()
      .from(projectOwnerEnrollment)
      .where(eq(projectOwnerEnrollment.projectId, projectId))
      .limit(1)

    let owner;
    if (enrollment) {
      [owner] = await db.select().from(projectOwner).where(eq(projectOwner.id, enrollment.projectOwnerId))
    } else {
      // Fallback to project.createdBy if it maps to a project owner
      [owner] = await db.select().from(projectOwner).where(eq(projectOwner.userId, existingProject.createdBy))
    }

    if (!owner) {
      throw new AppError('No project owner profile found for this project. Please enroll a project owner first.', 400)
    }

    // Step 3 — Resolve or create a stub farm plot
    let plot = await db.select().from(farmPlot).where(eq(farmPlot.projectOwnerId, owner.id)).limit(1).then(rows => rows[0])

    if (!plot) {
      const plotId = uuidv7PK()
      await db.execute(sql`
        INSERT INTO farm_plot (
          id, project_owner_id, country, region, centroid, area_hectares, boundary_verified, boundary_collection_method
        ) VALUES (
          ${plotId}, ${owner.id}, ${existingProject.country}, ${existingProject.region}, ST_GeomFromText('POINT(0 0)', 4326), 10.00, true, 'walked_gps'
        )
      `)
      plot = await db.select().from(farmPlot).where(eq(farmPlot.id, plotId)).then(rows => rows[0])
    }

    // Step 4 — Resolve the CraftedClimate partner
    const [craftedClimatePartner] = await db.select()
      .from(partner)
      .where(and(eq(partner.partnerType, 'dMRV_provider'), eq(partner.status, 'approved')))
      .limit(1)

    if (!craftedClimatePartner) {
      throw new AppError('No approved dMRV partner found. Run db:seed first.', 500)
    }

    // Step 5 — Generate simulation IDs
    const now           = new Date()
    const timestamp     = now.getTime()
    const ccIngestionId = `msg-ingest-sim-${timestamp}`
    const verEventId    = `v-verify-sim-${timestamp}`
    const batchId       = `BATCH-SIM-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${timestamp}`
    const txHash        = `0x${Buffer.from(batchId).toString('hex').slice(0, 64).padEnd(64, '0')}`
    const merkleRoot    = `0x${Buffer.from(verEventId).toString('hex').slice(0, 64).padEnd(64, '0')}`
    const auditCid      = `QmSim${Buffer.from(batchId).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 44)}`

    return await db.transaction(async (tx) => {
      // Step 6 — Insert mrv_ingestion_event
      const [ingestionEvent] = await tx.insert(mrvIngestionEvent).values({
        ccIngestionId,
        projectId:           existingProject.id,
        plotId:              plot.id,
        projectOwnerId:      owner.id,
        partnerId:           craftedClimatePartner.id,
        deviceId:            `cs-node-sim-${existingProject.code.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        submissionTimestamp: now,
        ingestionStatus:     'verified',
      }).returning()

      // Step 7 — Insert mrv_verification_result
      let grossRemovals, leakage, buffer, net;
      if (existingProject.projectType === 'renewable_energy') {
        grossRemovals = 0.000285; leakage = 0.000005; buffer = 0.000020; net = 0.000260;
      } else {
        grossRemovals = 0.000142; leakage = 0.000002; buffer = 0.000010; net = 0.000130;
      }

      const [verificationResult] = await tx.insert(mrvVerificationResult).values({
        ingestionId:         ingestionEvent.id,
        projectId:           existingProject.id,
        verificationEventId: verEventId,
        methodologyApplied:  existingProject.projectType === 'renewable_energy'
                               ? 'Gold Standard GS4GG v2.0 - Sectoral Scope 1'
                               : 'Verra VM0042 v2.2 - Sectoral Scope 14',
        verificationStatus:  'success',
        aiModelId:           'CC_ML_VERIFIER_V4_CORE',
        aiConfidenceScore:   '0.9982',
        isAnomalous:         false,
        predictionClass:     'baseline_consistent',
        geoFenceStatus:      'valid',
        hardwareIntegrity:   'secure',
        grossRemovalsTco2e:  grossRemovals.toString(),
        leakageDeduction:    leakage.toString(),
        bufferContribution:  buffer.toString(),
        netCreditsIssued:    net.toString(),
        receivedAt:          now,
      }).returning()

      // Step 8 — Insert mrv_blockchain_anchor
      const [anchor] = await tx.insert(mrvBlockchainAnchor).values({
        resultId:        verificationResult.id,
        projectId:       existingProject.id,
        network:         'Polygon_PoS_Mainnet',
        contractAddress: '0x0000000000000000000000000000000000000001',
        transactionHash: txHash,
        blockHeight:     99999999 + Math.floor(Math.random() * 1000),
        batchId,
        vintage:         now.getFullYear(),
        merkleRoot,
        auditUri:        `ipfs://${auditCid}`,
        anchoredAt:      now,
      }).returning()

      // Step 9 — Update project stage to "active"
      await tx.update(project)
        .set({ projectStage: 'active', projectStatus: 'active' })
        .where(eq(project.id, projectId))

      // Step 10 — Return results
      return {
        ingestionEvent,
        verificationResult,
        anchor,
        summary: {
          projectCode:       existingProject.code,
          deviceId:          ingestionEvent.deviceId,
          methodology:       verificationResult.methodologyApplied,
          netCreditsIssued:  verificationResult.netCreditsIssued,
          verificationStatus: 'success',
          blockchainNetwork: anchor.network,
          transactionHash:   anchor.transactionHash,
          auditUri:          anchor.auditUri,
          batchId:           anchor.batchId,
          vintage:           anchor.vintage,
        }
      }
    })
  }
}

export default MrvSimulationService
