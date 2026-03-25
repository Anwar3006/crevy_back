import "@config/env"; // MUST be first — populates process.env before settings.ts evaluates
import { prepareDB } from "@config/db";
import { errorLogStream, pinoLogger } from "@config/logger";
import settings from "@config/settings";
import v1Router from "@v1/index";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import morgan from "morgan";
import multer from "multer";
import { toNodeHandler } from "better-auth/node";

import { auth } from "@shared/utils/auth";
import { globalErrorHandler, NotFound } from "@shared/errors/errorHandler";

console.log("Frontend: ", settings.FRONTEND_URL);
const app = express();
const upload = multer();
app.use(morgan("dev"));
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://crevy-frontend.vercel.app",
      "https://bx9dscmp-3000.uks1.devtunnels.ms",
      "https://crevy-frontend.netlify.app",
      settings.FRONTEND_URL,
    ],
    credentials: true,
  }),
);

app.use(express.urlencoded());
app.use(cookieParser());
app.use(upload.none());

app.use(
  morgan("common", {
    stream: errorLogStream,
    skip: (__, res) => res.statusCode < 400,
  }),
);

// Better Auth
app.all("/api/auth/{*any}", toNodeHandler(auth));

// Mount express json middleware after Better Auth handler
app.use(express.json());

app.use("/api/v1", v1Router);

// Global error handler
app.use(NotFound);
app.use(globalErrorHandler);

app.listen(settings.APP_PORT, () =>
  pinoLogger.info(`Server running on port ${settings.APP_PORT}`),
);
// prepareDB();
