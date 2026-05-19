// src/v2/deps/routes/currency.route.ts
import { Router } from "express";
import CurrencyController from "../controllers/currency.controller";
import { requireAuth } from "@/middleware/auth.middleware";
import validateInboundRequest from "@/middleware/validateInboundRequest.middleware";
import { UpsertCurrencySchema, GetOrDeleteCurrencySchema } from "../schemas/currency.schema";

const router = Router();

router.get(
  "/",
  requireAuth,
  CurrencyController.getCurrencies
);

router.get(
  "/:id",
  requireAuth,
  validateInboundRequest(GetOrDeleteCurrencySchema),
  CurrencyController.getCurrencyById
);

router.put(
  "/",
  requireAuth,
  validateInboundRequest(UpsertCurrencySchema),
  CurrencyController.upsertCurrency
);

router.delete(
  "/:id",
  requireAuth,
  validateInboundRequest(GetOrDeleteCurrencySchema),
  CurrencyController.deleteCurrency
);

export default router;
