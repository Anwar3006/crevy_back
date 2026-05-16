import { Router } from 'express';
import { requireAuth, requirePermission } from '@/middleware/auth.middleware';
import validateInboundRequest from '@/middleware/validateInboundRequest.middleware';
import CreditController from '../controllers/credit.controller';
import {
  CreateCarbonCreditSchema,
  CreateCreditVerificationSchema,
  CreditIdParamsSchema,
  ListCarbonCreditsQuerySchema,
  ListCreditTransactionsQuerySchema,
  ListCreditVerificationsQuerySchema,
  PurchaseCarbonCreditSchema,
  RetireCarbonCreditSchema,
  TransactionIdParamsSchema,
  UpdateCarbonCreditStatusSchema,
  UpdateCreditVerificationSchema,
  VerificationIdParamsSchema,
} from '../schemas/credit.schema';

const creditRouter = Router();

// ── Carbon credits ──────────────────────────────────────────────────────────
/**
 * @swagger
 * /credits/carbon-credits:
 *   post:
 *     summary: Create carbon credits
 *     tags: [Credits]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CarbonCredit'
 *     responses:
 *       201:
 *         description: Credit created successfully
 *   get:
 *     summary: List carbon credits
 *     tags: [Credits]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: A list of carbon credits
 *
 * /credits/carbon-credits/{id}/purchase:
 *   post:
 *     summary: Purchase carbon credits
 *     tags: [Credits - Transactions]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [quantity, pricePerCredit, currencyId]
 *             properties:
 *               quantity:
 *                 type: number
 *               pricePerCredit:
 *                 type: number
 *               currencyId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Purchase successful
 */
creditRouter.post(
  '/carbon-credits',
  requireAuth,
  requirePermission(['credits', 'manage']),
  validateInboundRequest(CreateCarbonCreditSchema),
  CreditController.createCarbonCredit,
);

creditRouter.get(
  '/carbon-credits',
  requireAuth,
  validateInboundRequest(ListCarbonCreditsQuerySchema),
  CreditController.listCarbonCredits,
);

creditRouter.get(
  '/carbon-credits/:id',
  requireAuth,
  validateInboundRequest(CreditIdParamsSchema),
  CreditController.getCarbonCreditById,
);

creditRouter.patch(
  '/carbon-credits/:id/status',
  requireAuth,
  requirePermission(['credits', 'manage']),
  validateInboundRequest(UpdateCarbonCreditStatusSchema),
  CreditController.updateCarbonCreditStatus,
);

creditRouter.post(
  '/carbon-credits/:id/purchase',
  requireAuth,
  validateInboundRequest(PurchaseCarbonCreditSchema),
  CreditController.purchaseCarbonCredit,
);

creditRouter.post(
  '/carbon-credits/:id/retire',
  requireAuth,
  validateInboundRequest(RetireCarbonCreditSchema),
  CreditController.retireCarbonCredit,
);

// ── Transactions ────────────────────────────────────────────────────────────
/**
 * @swagger
 * /credits/transactions:
 *   get:
 *     summary: List credit transactions
 *     tags: [Credits - Transactions]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: A list of transactions
 */
creditRouter.get(
  '/transactions',
  requireAuth,
  validateInboundRequest(ListCreditTransactionsQuerySchema),
  CreditController.listTransactions,
);

creditRouter.get(
  '/transactions/:id',
  requireAuth,
  validateInboundRequest(TransactionIdParamsSchema),
  CreditController.getTransactionById,
);

// ── Verifications ───────────────────────────────────────────────────────────
/**
 * @swagger
 * /credits/verifications:
 *   get:
 *     summary: List credit verifications
 *     tags: [Credits - Verifications]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: A list of verifications
 */
creditRouter.post(
  '/verifications',
  requireAuth,
  requirePermission(['credits', 'manage']),
  validateInboundRequest(CreateCreditVerificationSchema),
  CreditController.createVerification,
);

creditRouter.get(
  '/verifications',
  requireAuth,
  validateInboundRequest(ListCreditVerificationsQuerySchema),
  CreditController.listVerifications,
);

creditRouter.get(
  '/verifications/:id',
  requireAuth,
  validateInboundRequest(VerificationIdParamsSchema),
  CreditController.getVerificationById,
);

creditRouter.patch(
  '/verifications/:id',
  requireAuth,
  requirePermission(['credits', 'manage']),
  validateInboundRequest(UpdateCreditVerificationSchema),
  CreditController.updateVerification,
);


export default creditRouter;
