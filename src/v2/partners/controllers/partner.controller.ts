// src/v2/partners/controllers/partner.controller.ts
import { catchAsync } from "@/shared/errors/errorHandler";
import { NextFunction, Request, Response } from "express";
import PartnerService from "../services/partner.service";

/**
 * All input validation is handled upstream by validateInboundRequest (Zod).
 * By the time a handler runs, req.body and req.params are already validated
 * and coerced — no manual field checks needed here.
 *
 * We explicitly extract body and params before passing to the service so:
 *   1. The service receives exactly the shape its type signature declares.
 *   2. We are never passing the raw Express Request into domain logic.
 */
const PartnerController = {

  createPartner: catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
    const result = await PartnerService.createPartner({ body: req.body });

    return res.status(201).json({
      success: true,
      message: "Partner created successfully",
      data: result,
    });
  }),

  updatePartner: catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
    // req.params.id was coerced to a number by UpdatePartnerSchema via z.coerce.number()
    const result = await PartnerService.updatePartner({
      body:   req.body,
      params: { id: Number(req.params.id) },
    });

    return res.status(200).json({
      success: true,
      message: "Partner updated successfully",
      data: result,
    });
  }),

  getPartnerById: catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
    const result = await PartnerService.getPartnerById(Number(req.params.id));

    return res.status(200).json({
      success: true,
      message: "Partner fetched successfully",
      data: result,
    });
  }),

  getPartners: catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
    const result = await PartnerService.getPartners(req.query as any);

    return res.status(200).json({
      success: true,
      message: "Partners fetched successfully",
      data: result.data,
      nextCursor: result.nextCursor,
    });
  }),

  deletePartner: catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
    await PartnerService.deletePartner(Number(req.params.id));
    return res.status(204).send();
  }),
};

export default PartnerController;
