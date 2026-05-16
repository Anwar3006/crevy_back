import { Request, Response, NextFunction } from "express";
import { auth } from "@/shared/utils/auth";
import { Session, User } from "better-auth/types";
import RBACService from "@/v2/rbac/service/rbac.service";

declare global {
  namespace Express {
    interface Request {
      user?: User;
      session?: Session;
    }
  }
}

// AuthN middleware
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



/**
 * AuthZ: requirePermission
 * Ensures the authenticated user has the necessary RBAC permission.
 * MUST be placed after requireAuth in the route chain.
 */
export const requirePermission = (...requirements: (string | [string, string])[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      // Normalize inputs
      // this will look like [["project_owners", "manage"], ["projects", "create"]]
      const checks: [string, string][] = Array.isArray(requirements[0])
        ? (requirements as [string, string][])
        : [[requirements[0] as string, requirements[1] as string]];
        
      //check if user has any of the required permissions using Promise.all
      const results = await Promise.all(
        checks.map(([resource, action]) => 
          RBACService.hasPermission(req.user!.id, resource, action)
        )
      );

      //if user has any of the required permissions, allow access
      if (results.some(hasPerm => hasPerm === true)) {
        return next();
      }

      return res.status(403).json({
        success: false,
        message: "Forbidden: You do not have the required permission",
      });
    } catch (error) {
      console.error("Authorization error:", error);
      next(error);
    }
  };
};