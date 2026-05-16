// src/v2/mrv/controllers/mrv.controller.ts
import { Request, Response } from "express";
import { catchAsync } from "@/shared/errors/errorHandler";
import MrvService from "../services/mrv.service";

/**
 * All input validation is handled upstream by validateInboundRequest (Zod).
 * Webhook routes use requireMrvWebhookAuth instead of requireAuth.
 */
const MrvController = {

  registerIngestion: catchAsync(async (req: Request, res: Response) => {
    const result = await MrvService.registerIngestion(req.body);
    return res.status(201).json({
      success: true,
      message: "MRV ingestion event registered successfully",
      data: result,
    });
  }),

  handleIngestionWebhook: catchAsync(async (req: Request, res: Response) => {
    const result = await MrvService.handleIngestionWebhook(req.body);
    return res.status(200).json({
      success: true,
      message: "Ingestion webhook processed",
      data: result,
    });
  }),

  handleVerificationWebhook: catchAsync(async (req: Request, res: Response) => {
    const result = await MrvService.handleVerificationWebhook(req.body);
    return res.status(200).json({
      success: true,
      message: "Verification webhook processed",
      data: result,
    });
  }),

  handleBlockchainWebhook: catchAsync(async (req: Request, res: Response) => {
    const result = await MrvService.handleBlockchainWebhook(req.body);
    return res.status(200).json({
      success: true,
      message: "Blockchain anchor webhook processed",
      data: result,
    });
  }),

  getIngestionStatus: catchAsync(async (req: Request, res: Response) => {
    const result = await MrvService.getIngestionStatus(req.params.ccIngestionId as string);
    return res.status(200).json({
      success: true,
      message: "Ingestion event retrieved",
      data: result,
    });
  }),

  getIngestionsByProject: catchAsync(async (req: Request, res: Response) => {
    const result = await MrvService.getIngestionsByProject(req.params.projectId as string);
    return res.status(200).json({
      success: true,
      message: "Ingestion events retrieved",
      data: result,
    });
  }),

  getVerificationsByProject: catchAsync(async (req: Request, res: Response) => {
    const result = await MrvService.getVerificationsByProject(req.params.projectId as string);
    return res.status(200).json({
      success: true,
      message: "Verification results retrieved",
      data: result,
    });
  }),

  getAnchorsByProject: catchAsync(async (req: Request, res: Response) => {
    const result = await MrvService.getAnchorsByProject(req.params.projectId as string);
    return res.status(200).json({
      success: true,
      message: "Blockchain anchors retrieved",
      data: result,
    });
  }),
};

export default MrvController;
