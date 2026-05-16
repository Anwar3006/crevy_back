// src/v2/projects/controllers/project_document.controller.ts
import { Request, Response } from "express";
import { catchAsync } from "@/shared/errors/errorHandler";
import ProjectDocumentService from "../services/project_document.service";

const ProjectDocumentController = {
  uploadDocument: catchAsync(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const result = await ProjectDocumentService.uploadDocument(req.params.id as string, req.body, userId);
    return res.status(201).json({
      success: true,
      message: "Document uploaded successfully",
      data: result,
    });
  }),

  listDocuments: catchAsync(async (req: Request, res: Response) => {
    const result = await ProjectDocumentService.listDocuments(req.params.id as string);
    return res.status(200).json({
      success: true,
      data: result,
    });
  }),

  verifyDocument: catchAsync(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const result = await ProjectDocumentService.verifyDocument(req.params.docId as string, userId);
    return res.status(200).json({
      success: true,
      message: "Document verified successfully",
      data: result,
    });
  }),

  deleteDocument: catchAsync(async (req: Request, res: Response) => {
    const result = await ProjectDocumentService.deleteDocument(req.params.docId as string);
    return res.status(200).json({
      success: true,
      message: "Document deleted successfully",
      data: result,
    });
  }),
};

export default ProjectDocumentController;
