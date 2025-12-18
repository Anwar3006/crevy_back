import type { NextFunction, Request, Response } from "express";

import AppError from "./AppError.js";
import settings from "@/config/settings.js";
//nssgc

export const NotFound = (req: Request, _: Response, next: NextFunction) => {
  const error = new AppError(
    `Can't find ${req.originalUrl} on this server!`,
    404
  );
  next(error);
};

export const sendErrorDev = (err: AppError, res: Response) => {
  res.status(err.statusCode).json({
    status: err.status,
    stack: err.stack,
    error: err,
    message: err.message,
  });
};

export const sendErrorProd = (err: AppError, res: Response) => {
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  }

  console.error("Error discovered: " + err);
  res.status(500).json({
    status: "error",
    message: "Internal Server Error",
  });
};

//middleware
export const globalErrorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  if (settings.NODE_ENV === "development") {
    sendErrorDev(err, res);
  } else {
    sendErrorProd(err, res);
  }
};

export const catchAsync = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      fn(req, res, next);
    } catch (error) {
      next(error);
    }
  };
};
