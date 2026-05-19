// src/v2/deps/controllers/currency.controller.ts
import { catchAsync } from "@/shared/errors/errorHandler";
import { Request, Response } from "express";
import CurrencyService from "../services/currency.service";
import AppError from "@/shared/errors/AppError";

const CurrencyController = {
  getCurrencies: catchAsync(async (_req: Request, res: Response) => {
    const currencies = await CurrencyService.getAll();
    return res.status(200).json({
      success: true,
      data: currencies,
    });
  }),

  getCurrencyById: catchAsync(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const item = await CurrencyService.getById(id);

    if (!item) {
      throw new AppError(`Currency with ID ${id} not found`, 404);
    }

    return res.status(200).json({
      success: true,
      data: item,
    });
  }),

  upsertCurrency: catchAsync(async (req: Request, res: Response) => {
    const { code, name } = req.body;
    const item = await CurrencyService.upsert(code, name);

    return res.status(200).json({
      success: true,
      message: "Currency upserted successfully",
      data: item,
    });
  }),

  deleteCurrency: catchAsync(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const item = await CurrencyService.delete(id);

    if (!item) {
      throw new AppError(`Currency with ID ${id} not found`, 404);
    }

    return res.status(200).json({
      success: true,
      message: "Currency deleted successfully",
    });
  }),
};

export default CurrencyController;
