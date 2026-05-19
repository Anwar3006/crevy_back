// src/v2/index.ts
import express from "express";
import { healthRouter } from "@/v1/health/routes/health";

// v2 auth — replaces v1 authRouter. better-auth session routes (/sign-in,
// /sign-out, /get-session) are still mounted at /api/auth in src/index.ts.
import authV2Router                  from "./auth/routes/auth.route";
import rbacRouter                    from "./rbac/routes/rbac.route";
import partnerRouter                 from "./partners/routes/partner.route";
import projectOwnerRouter            from "./project_owners/routes/project_owner.route";
import farmPlotRouter                from "./project_owners/routes/farm_plot.route";
import projectOwnerAssignmentRouter  from "./project_owners/routes/project_owner_assignment.route";
import projectRouter                 from "./projects/routes/project.route";
import mrvRouter                     from "./mrv/routes/mrv.route";
import notificationRouter            from "./notifications/routes/notification.route";
import creditRouter                  from "./credits/routes/credit.route";
import financialsRouter              from "./financials/routes/financials.route";
import currencyRouter                from "./deps/routes/currency.route";

const v2Router = express.Router();

v2Router.use("/health",                    healthRouter);
v2Router.use("/auth",                      authV2Router);         // ← v2 auth (not v1)
v2Router.use("/rbac",                      rbacRouter);
v2Router.use("/partners",                  partnerRouter);
v2Router.use("/project-owners",            projectOwnerRouter);
v2Router.use("/farm-plots",                farmPlotRouter);
v2Router.use("/project-owner-assignments", projectOwnerAssignmentRouter);
v2Router.use("/projects",                  projectRouter);
v2Router.use("/mrv",                       mrvRouter);
v2Router.use("/notifications",             notificationRouter);
v2Router.use("/credits",                   creditRouter);
v2Router.use("/financials",                financialsRouter);
v2Router.use("/currencies",                currencyRouter);

export default v2Router;
