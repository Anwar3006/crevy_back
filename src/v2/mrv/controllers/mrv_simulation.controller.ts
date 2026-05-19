import { catchAsync } from '@/shared/errors/errorHandler'
import { Request, Response } from 'express'
import MrvSimulationService from '../services/mrv_simulation.service'

const MrvSimulationController = {
  simulate: catchAsync(async (req: Request, res: Response) => {
    const { projectId } = req.params
    const result = await MrvSimulationService.simulateFullMrvPipeline(projectId as string)

    return res.status(200).json({
      success: true,
      message: 'MRV pipeline simulation completed. All three stages — Ingestion, Verification, and Blockchain Anchor — have been simulated with real database insertions.',
      data: result,
    })
  }),
}

export default MrvSimulationController
