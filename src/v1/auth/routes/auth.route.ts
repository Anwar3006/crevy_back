import express from "express";
import validateInboundRequest from "@/middleware/validateInboundRequest.middleware";
import {
  signUpSchema,
  signInSchema,
  completeProfileSchema,
} from "../schema/authSchema";
import AuthController from "../controllers/auth.controller";
// Import your auth middleware to protect routes
// import { requireAuth } from "@/middleware/auth.middleware";

const authRouter = express.Router();

/**
 * POST /api/v1/auth/register
 * Register a new user with email/password (Company or ProjectOwner)
 * Uses manual atomic transaction
 */
authRouter.post(
  "/register",
  validateInboundRequest(signUpSchema),
  AuthController.registerUser
);

/**
 * POST /api/v1/auth/complete-profile
 * Complete profile for users who signed up via social providers
 * Requires authentication
 * Uses manual atomic transaction
 */
authRouter.post(
  "/complete-profile",
  // requireAuth, // Uncomment when auth middleware is ready
  validateInboundRequest(completeProfileSchema),
  AuthController.completeProfile
);

/**
 * POST /api/v1/auth/login
 * Login with email and password
 */
authRouter.post(
  "/login",
  validateInboundRequest(signInSchema),
  AuthController.loginUser
);

/**
 * POST /api/v1/auth/logout
 * Logout current user
 */
authRouter.post("/logout", AuthController.logoutUser);

export { authRouter };
