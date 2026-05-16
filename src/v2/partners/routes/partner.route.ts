// src/v2/partners/routes/partner.route.ts
import { Router } from "express";
import { requireAuth } from "@/middleware/auth.middleware";
import validateInboundRequest from "@/middleware/validateInboundRequest.middleware";
import { CreatePartnerSchema, UpdatePartnerSchema } from "../schema/partner.schema";
import PartnerController from "../controllers/partner.controller";

const partnerRouter = Router();

// Route order: requireAuth → validateInboundRequest → controller
// Auth check happens before we bother parsing the body.
// requirePermission('partners', 'manage') will be added once the
// permission-seeding infrastructure is stable across test files.

/**
 * @swagger
 * /partners:
 *   post:
 *     summary: Create a new partner
 *     tags: [Partners]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, partnerType, contactPerson, contactEmail]
 *             properties:
 *               name:
 *                 type: string
 *               partnerType:
 *                 type: string
 *                 enum: [registry, auditing_body, dMRV_provider, technology_provider, aggregator, NGO, financial_institution, channel]
 *               contactPerson:
 *                 type: string
 *               contactEmail:
 *                 type: string
 *                 format: email
 *               contactPhone:
 *                 type: string
 *               country:
 *                 type: string
 *     responses:
 *       201:
 *         description: Partner created successfully
 *   get:
 *     summary: List all partners
 *     tags: [Partners]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: A list of partners
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Partner'
 *
 * /partners/{id}:
 *   get:
 *     summary: Get partner by ID
 *     tags: [Partners]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Partner details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Partner'
 *   put:
 *     summary: Update an existing partner
 *     tags: [Partners]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Partner'
 *     responses:
 *       200:
 *         description: Partner updated successfully
 *   delete:
 *     summary: Delete a partner
 *     tags: [Partners]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       204:
 *         description: Partner deleted successfully
 */
partnerRouter.post(
  "/",
  requireAuth,
  validateInboundRequest(CreatePartnerSchema),
  PartnerController.createPartner
);

partnerRouter.put(
  "/:id",
  requireAuth,
  validateInboundRequest(UpdatePartnerSchema),
  PartnerController.updatePartner
);

partnerRouter.get(
  "/",
  requireAuth,
  PartnerController.getPartners
);

partnerRouter.get(
  "/:id",
  requireAuth,
  PartnerController.getPartnerById
);

partnerRouter.delete(
  "/:id",
  requireAuth,
  PartnerController.deletePartner
);

export default partnerRouter;
