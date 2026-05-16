// src/v2/mrv/middleware/mrv_webhook.middleware.ts
import { Request, Response, NextFunction } from "express";
import { createHash } from "crypto";

/**
 * Authenticates incoming webhook requests from CraftedClimate.
 *
 * Two-layer verification:
 *   Layer 1 — Bearer token: Authorization header must match CC_WEBHOOK_SECRET.
 *   Layer 2 — Content integrity (optional): if the caller sends an
 *             x-content-sha256 header, the SHA-256 of the raw body must match.
 *
 * MUST be placed BEFORE validateInboundRequest in the route chain so that
 * unauthenticated calls are rejected before Zod even runs.
 *
 * This middleware does NOT use requireAuth — webhook calls are machine-to-machine
 * and are never associated with a Crevy user session.
 */
export const requireMrvWebhookAuth = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Missing or malformed webhook authorization header",
    });
  }

  const token = authHeader.slice(7); // strip "Bearer "
  const expected = process.env.CC_WEBHOOK_SECRET;

  if (!expected) {
    console.error("[MRV webhook] CC_WEBHOOK_SECRET is not set in environment");
    return res.status(500).json({
      success: false,
      message: "Webhook secret not configured on this server",
    });
  }

  if (token !== expected) {
    return res.status(401).json({
      success: false,
      message: "Invalid webhook token",
    });
  }

  // Optional content-integrity check
  const contentSha = req.headers["x-content-sha256"] as string | undefined;
  if (contentSha) {
    const bodyHash = createHash("sha256")
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (bodyHash !== contentSha) {
      return res.status(400).json({
        success: false,
        message: "Webhook payload integrity check failed — content_sha256 mismatch",
      });
    }
  }

  next();
};
