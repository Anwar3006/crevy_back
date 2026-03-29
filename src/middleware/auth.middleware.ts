import { Request, Response, NextFunction } from "express";
import { auth } from "@/shared/utils/auth";
import { Session, User } from "better-auth/types";

declare global {
  namespace Express {
    interface Request {
      user?: User;
      session?: Session;
    }
  }
}

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
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

export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const session = await auth.api.getSession({
      headers: req.headers as any,
    });

    if (session) {
      req.user = session.user;
      req.session = session.session;
    }
  } catch (_) {
    // swallow — auth is optional
  }
  next();
};
