import { authRouter } from "@/v1/auth/routes/auth.route";
import express from "express";
import { healthRouter } from "@/v1/health/routes/health";
import projectRouter from "@/v1/projects/routes/project.route";

const v1Router = express.Router();
v1Router.use("/health", healthRouter);
v1Router.use("/auth", authRouter);
v1Router.use("/projects", projectRouter);

export default v1Router;
