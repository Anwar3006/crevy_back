// src/v2/financials/controllers/financials.controller.ts
import { Request, Response } from "express";
import { catchAsync } from "@/shared/errors/errorHandler";
import FinancialsService from "../services/financials.service";

const FinancialsController = {
  // ─── Contract ────────────────────────────────────────────────────────────────

  createContract: catchAsync(async (req: Request, res: Response) => {
    const result = await FinancialsService.createContract(req.body);
    return res.status(201).json({
      success: true,
      message: "Contract created successfully",
      data: result,
    });
  }),

  updateContract: catchAsync(async (req: Request, res: Response) => {
    const result = await FinancialsService.updateContract(req.params.id as string, req.body);
    return res.status(200).json({
      success: true,
      message: "Contract updated successfully",
      data: result,
    });
  }),

  getContractById: catchAsync(async (req: Request, res: Response) => {
    const result = await FinancialsService.getContractById(req.params.id as string);
    return res.status(200).json({
      success: true,
      data: result,
    });
  }),

  listContracts: catchAsync(async (req: Request, res: Response) => {
    const result = await FinancialsService.listContracts(req.query as any);
    return res.status(200).json({
      success: true,
      data: result,
    });
  }),

  // ─── Payout ──────────────────────────────────────────────────────────────────

  createPayout: catchAsync(async (req: Request, res: Response) => {
    const result = await FinancialsService.createPayout(req.body);
    return res.status(201).json({
      success: true,
      message: "Payout created successfully",
      data: result,
    });
  }),

  updatePayout: catchAsync(async (req: Request, res: Response) => {
    const result = await FinancialsService.updatePayout(req.params.id as string, req.body);
    return res.status(200).json({
      success: true,
      message: "Payout updated successfully",
      data: result,
    });
  }),

  getPayoutById: catchAsync(async (req: Request, res: Response) => {
    const result = await FinancialsService.getPayoutById(req.params.id as string);
    return res.status(200).json({
      success: true,
      data: result,
    });
  }),

  listPayouts: catchAsync(async (req: Request, res: Response) => {
    const result = await FinancialsService.listPayouts(req.query as any);
    return res.status(200).json({
      success: true,
      data: result,
    });
  }),

  // ─── Financial Record ────────────────────────────────────────────────────────

  createFinancialRecord: catchAsync(async (req: Request, res: Response) => {
    const result = await FinancialsService.createFinancialRecord(req.body);
    return res.status(201).json({
      success: true,
      message: "Financial record created successfully",
      data: result,
    });
  }),

  getFinancialRecordById: catchAsync(async (req: Request, res: Response) => {
    const result = await FinancialsService.getFinancialRecordById(req.params.id as string);
    return res.status(200).json({
      success: true,
      data: result,
    });
  }),

  listFinancialRecords: catchAsync(async (req: Request, res: Response) => {
    const result = await FinancialsService.listFinancialRecords(req.query as any);
    return res.status(200).json({
      success: true,
      data: result,
    });
  }),
};

export default FinancialsController;
