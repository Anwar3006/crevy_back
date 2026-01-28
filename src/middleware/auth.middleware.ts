import { Request, Response, NextFunction } from "express";
import { auth } from "@/shared/utils/auth";
import { Session, User } from "better-auth/types";

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
      session?: Session;
    }
  }
}

/**
 * Authentication middleware that verifies the user session
 * and attaches the user object to req.user
 */
export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // Get the session token from cookies or Authorization header
    const token =
      req.cookies?.["better-auth.session_token"] ||
      req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. No token provided.",
        data: null,
      });
    }

    // Verify the session using better-auth
    const session = await auth.api.getSession({
      headers: req.headers as any,
    });

    if (!session) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired session. Please login again.",
        data: null,
      });
    }

    // Attach user and session to request object
    req.user = session.user;
    req.session = session.session;

    next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(401).json({
      success: false,
      message: "Authentication failed. Please login again.",
      data: null,
    });
  }
};

/**
 * Optional authentication middleware
 * Attaches user if authenticated, but doesn't require it
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token =
      req.cookies?.["better-auth.session_token"] ||
      req.headers.authorization?.replace("Bearer ", "");

    if (token) {
      const session = await auth.api.getSession({
        headers: req.headers as any,
      });

      if (session) {
        req.user = session.user;
        req.session = session.session;
      }
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};
