import "@config/env";
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
import v2Router from "./v2";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./config/swagger";

const app = express();

// ─── CRITICAL FOR PROXYING ──────────────────────────────────────────────────
// This tells Express to trust the X-Forwarded-* headers sent by Render/Vercel.
// Without this, Better Auth cannot correctly detect the frontend's domain.
// ─────────────────────────────────────────────────────────────────────────────
app.set("trust proxy", true);

const upload = multer();
app.use(morgan("dev"));

const allowedOrigins = [
  "http://localhost:3000",
  "https://crevy-frontend.vercel.app",
  "https://crevy-frontend-yttg.vercel.app", // Added your specific Vercel URL
  "https://bx9dscmp-3000.uks1.devtunnels.ms",
  "https://crevy-frontend.netlify.app",
  settings.FRONTEND_URL,
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(upload.none());

app.use(
  morgan("common", {
    stream: errorLogStream,
    skip: (__, res) => res.statusCode < 400,
  }),
);

// Better Auth - Must be mounted before express.json() for body parsing
app.all("/api/auth/{*any}", toNodeHandler(auth));

app.use(express.json());
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/api/v1", v1Router);
app.use(`/api/${settings.API_VERSION}`, v2Router);

app.use(NotFound);
app.use(globalErrorHandler);



export default app;
