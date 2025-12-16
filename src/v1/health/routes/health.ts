import express, { type Request, type Response } from "express";
import type { TResponsePayload } from "@/shared/types";

const healthRouter = express.Router();
healthRouter.get("/", (_: Request, res: Response<TResponsePayload>) =>
  res.json({ success: true, message: "API is healthy", data: {} }),
);
export { healthRouter };
