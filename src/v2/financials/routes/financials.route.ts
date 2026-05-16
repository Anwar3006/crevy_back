// src/v2/financials/routes/financials.route.ts
import { Router } from "express";
import { requireAuth, requirePermission } from "@/middleware/auth.middleware";
import validateInboundRequest from "@/middleware/validateInboundRequest.middleware";
import {
  CreateContractSchema,
  UpdateContractSchema,
  CreatePayoutSchema,
  UpdatePayoutSchema,
  CreateFinancialRecordSchema,
  ListFinancialsQuerySchema,
} from "../schemas/financials.schema";
import FinancialsController from "../controllers/financials.controller";

const financialsRouter = Router();

// ─── Contracts ───────────────────────────────────────────────────────────────

/**
 * @swagger
 * /financials/contracts:
 *   post:
 *     summary: Create a new contract
 *     tags: [Financials - Contracts]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Contract'
 *     responses:
 *       201:
 *         description: Contract created successfully
 *   get:
 *     summary: List contracts
 *     tags: [Financials - Contracts]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of contracts
 *
 * /financials/payouts:
 *   post:
 *     summary: Create a new payout
 *     tags: [Financials - Payouts]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Payout'
 *     responses:
 *       201:
 *         description: Payout created successfully
 *   get:
 *     summary: List payouts
 *     tags: [Financials - Payouts]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of payouts
 *
 * /financials/records:
 *   post:
 *     summary: Create a financial record
 *     tags: [Financials - Records]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FinancialRecord'
 *     responses:
 *       201:
 *         description: Record created successfully
 *   get:
 *     summary: List financial records
 *     tags: [Financials - Records]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of records
 */
financialsRouter.post(
  "/contracts",
  requireAuth,
  requirePermission(["financials", "manage"]),
  validateInboundRequest(CreateContractSchema),
  FinancialsController.createContract
);

financialsRouter.put(
  "/contracts/:id",
  requireAuth,
  requirePermission(["financials", "manage"]),
  validateInboundRequest(UpdateContractSchema),
  FinancialsController.updateContract
);

financialsRouter.get(
  "/contracts",
  requireAuth,
  requirePermission(["financials", "view"]),
  validateInboundRequest(ListFinancialsQuerySchema),
  FinancialsController.listContracts
);

financialsRouter.get(
  "/contracts/:id",
  requireAuth,
  requirePermission(["financials", "view"]),
  FinancialsController.getContractById
);

// ─── Payouts ─────────────────────────────────────────────────────────────────

financialsRouter.post(
  "/payouts",
  requireAuth,
  requirePermission(["financials", "manage"]),
  validateInboundRequest(CreatePayoutSchema),
  FinancialsController.createPayout
);

financialsRouter.put(
  "/payouts/:id",
  requireAuth,
  requirePermission(["financials", "manage"]),
  validateInboundRequest(UpdatePayoutSchema),
  FinancialsController.updatePayout
);

financialsRouter.get(
  "/payouts",
  requireAuth,
  requirePermission(["financials", "view"]),
  validateInboundRequest(ListFinancialsQuerySchema),
  FinancialsController.listPayouts
);

financialsRouter.get(
  "/payouts/:id",
  requireAuth,
  requirePermission(["financials", "view"]),
  FinancialsController.getPayoutById
);

// ─── Financial Records ───────────────────────────────────────────────────────

financialsRouter.post(
  "/records",
  requireAuth,
  requirePermission(["financials", "manage"]),
  validateInboundRequest(CreateFinancialRecordSchema),
  FinancialsController.createFinancialRecord
);

financialsRouter.get(
  "/records",
  requireAuth,
  requirePermission(["financials", "view"]),
  validateInboundRequest(ListFinancialsQuerySchema),
  FinancialsController.listFinancialRecords
);

financialsRouter.get(
  "/records/:id",
  requireAuth,
  requirePermission(["financials", "view"]),
  FinancialsController.getFinancialRecordById
);


export default financialsRouter;
