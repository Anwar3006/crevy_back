import { Router } from "express";
import { requireAuth } from "@/middleware/auth.middleware";
import validateInboundRequest from "@/middleware/validateInboundRequest.middleware";
import { CreateFarmPlotSchema, ListFarmPlotsQuerySchema, UpdateFarmPlotSchema } from "../schemas/farm_plot.schema";
import FarmPlotController from "../controllers/farm_plot.controller";

const farmPlotRouter = Router();

/**
 * @swagger
 * /farm-plots:
 *   post:
 *     summary: Create a new farm plot
 *     tags: [Project Owners - Farm Plots]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       201:
 *         description: Plot created successfully
 *   get:
 *     summary: List farm plots
 *     tags: [Project Owners - Farm Plots]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: A list of farm plots
 */
farmPlotRouter.post(
  "/",
  requireAuth,
  validateInboundRequest(CreateFarmPlotSchema),
  FarmPlotController.createFarmPlot
);

farmPlotRouter.get(
  "/",
  requireAuth,
  validateInboundRequest(ListFarmPlotsQuerySchema),
  FarmPlotController.getFarmPlots
);

farmPlotRouter.get(
  "/:id",
  requireAuth,
  FarmPlotController.getFarmPlotById
);

farmPlotRouter.put(
  "/:id",
  requireAuth,
  validateInboundRequest(UpdateFarmPlotSchema),
  FarmPlotController.updateFarmPlot
);

farmPlotRouter.delete(
  "/:id",
  requireAuth,
  FarmPlotController.deleteFarmPlot
);

export default farmPlotRouter;
