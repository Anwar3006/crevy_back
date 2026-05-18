// src/v2/auth/routes/auth.route.ts
import { Router } from "express";
import validateInboundRequest from "@/middleware/validateInboundRequest.middleware";
import { registerSchema } from "../schemas/auth.schema";
import AuthV2Controller from "../controllers/auth.controller";

/**
 * V2 Auth routes
 *
 * NOTE: better-auth owns /sign-in, /sign-out, /get-session etc.
 * Those are mounted at /api/auth in src/index.ts and are NOT duplicated here.
 * This router only handles Crevy-specific registration logic that better-auth
 * does not cover (role assignment, etc.).
 */
const authV2Router = Router();

// Public — no auth required
authV2Router.post(
  "/register",
  validateInboundRequest(registerSchema),
  AuthV2Controller.registerUser,
);

export default authV2Router;
