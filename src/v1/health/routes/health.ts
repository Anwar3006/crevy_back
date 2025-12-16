import express, { type Request, type Response } from "express";
import type {
  EEnvironment,
  THealthStatus,
  TResponsePayload,
} from "@/shared/types";

const healthRouter = express.Router();
healthRouter.get(
  "/",
  (_: Request, res: Response<TResponsePayload<THealthStatus>>) =>
    res.json({
      success: true,
      message: "API is healthy",
      data: {
        environment: process.env.NODE_ENV as EEnvironment,
        appVersion: process.env.npm_package_version as string,
        timestamp: new Date().toISOString(),
      },
    }),
);
export { healthRouter };
