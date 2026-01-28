import { catchAsync } from "@/shared/errors/errorHandler";
import { TResponsePayload } from "@/shared/types";
import { NextFunction, Request, Response } from "express";

const ProjectController = {
  //Project Related
  createProject: catchAsync(
    async (
      req: Request,
      res: Response<TResponsePayload<any>>,
      next: NextFunction,
    ) => {},
  ),

  updateProject: catchAsync(
    async (
      req: Request,
      res: Response<TResponsePayload<any>>,
      next: NextFunction,
    ) => {},
  ),

  getAllUserProjects: catchAsync(
    async (
      req: Request,
      res: Response<TResponsePayload<any>>,
      next: NextFunction,
    ) => {},
  ),

  getSingleUserProject: catchAsync(
    async (
      req: Request,
      res: Response<TResponsePayload<any>>,
      next: NextFunction,
    ) => {},
  ),

  deleteUserProject: catchAsync(
    async (
      req: Request,
      res: Response<TResponsePayload<any>>,
      next: NextFunction,
    ) => {},
  ),

  //Carbon Calculation related

  //Documents
};

export default ProjectController;
