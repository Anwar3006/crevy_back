import { Router } from "express";
import ProjectController from "../controllers/project.controller";

const projectRouter = Router();

projectRouter.post("/", ProjectController.createProject);

projectRouter.put("/{id}", ProjectController.updateProject);

projectRouter.get("/", ProjectController.getAllUserProjects);
projectRouter.get("/{id}", ProjectController.getSingleUserProject);

projectRouter.delete("/{id}", ProjectController.deleteUserProject);

export default projectRouter;
