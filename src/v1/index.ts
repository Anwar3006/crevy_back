import { authRouter } from "@v1/auth/routes/auth";
import express from "express";
import { healthRouter } from "@/v1/health/routes/health";

const v1Router = express.Router();
v1Router.use("/health", healthRouter);
v1Router.use("/auth", authRouter);

export default v1Router;
