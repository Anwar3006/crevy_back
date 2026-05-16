import { Request, Response } from 'express';
import { catchAsync } from '@/shared/errors/errorHandler';
import CreditService from '../services/credit.service';

const CreditController = {
  createCarbonCredit: catchAsync(async (req: Request, res: Response) => {
    const result = await CreditService.createCarbonCredit(req.body);
    return res.status(201).json({
      success: true,
      message: 'Carbon credit created successfully',
      data: result,
    });
  }),

  listCarbonCredits: catchAsync(async (req: Request, res: Response) => {
    const result = await CreditService.listCarbonCredits(req.query as any);
    return res.status(200).json({ success: true, data: result });
  }),

  getCarbonCreditById: catchAsync(async (req: Request, res: Response) => {
    const result = await CreditService.getCarbonCreditById(String(req.params.id));
    return res.status(200).json({ success: true, data: result });
  }),

  updateCarbonCreditStatus: catchAsync(async (req: Request, res: Response) => {
    const result = await CreditService.updateCarbonCreditStatus({
      params: { id: String(req.params.id) },
      body: req.body,
    });
    return res.status(200).json({
      success: true,
      message: 'Carbon credit status updated successfully',
      data: result,
    });
  }),

  purchaseCarbonCredit: catchAsync(async (req: Request, res: Response) => {
    const result = await CreditService.purchaseCarbonCredit({
      params: { id: String(req.params.id) },
      body: req.body,
      buyerId: req.user!.id,
    });
    return res.status(201).json({
      success: true,
      message: 'Carbon credit purchased successfully',
      data: result,
    });
  }),

  retireCarbonCredit: catchAsync(async (req: Request, res: Response) => {
    const result = await CreditService.retireCarbonCredit({
      params: { id: String(req.params.id) },
      body: req.body,
      ownerId: req.user!.id,
    });
    return res.status(201).json({
      success: true,
      message: 'Carbon credit retired successfully',
      data: result,
    });
  }),

  listTransactions: catchAsync(async (req: Request, res: Response) => {
    const result = await CreditService.listTransactions(req.query as any);
    return res.status(200).json({ success: true, data: result });
  }),

  getTransactionById: catchAsync(async (req: Request, res: Response) => {
    const result = await CreditService.getTransactionById(String(req.params.id));
    return res.status(200).json({ success: true, data: result });
  }),

  createVerification: catchAsync(async (req: Request, res: Response) => {
    const result = await CreditService.createVerification(req.body);
    return res.status(201).json({
      success: true,
      message: 'Credit verification created successfully',
      data: result,
    });
  }),

  updateVerification: catchAsync(async (req: Request, res: Response) => {
    const result = await CreditService.updateVerification({
      params: { id: String(req.params.id) },
      body: req.body,
    });
    return res.status(200).json({
      success: true,
      message: 'Credit verification updated successfully',
      data: result,
    });
  }),

  getVerificationById: catchAsync(async (req: Request, res: Response) => {
    const result = await CreditService.getVerificationById(String(req.params.id));
    return res.status(200).json({ success: true, data: result });
  }),

  listVerifications: catchAsync(async (req: Request, res: Response) => {
    const result = await CreditService.listVerifications(req.query as any);
    return res.status(200).json({ success: true, data: result });
  }),
};

export default CreditController;
