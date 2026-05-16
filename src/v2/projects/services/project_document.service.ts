// src/v2/projects/services/project_document.service.ts
import { db } from "@/config/db";
import { eq, and } from "drizzle-orm";
import { projectDocument } from "../models/project_docs.model";
import { project } from "../models/project.model";
import AppError from "@/shared/errors/AppError";
import {
  TCreateProjectDocument,
} from "../schemas/project_document.schema";

const ProjectDocumentService = {
  uploadDocument: async (projectId: string, body: TCreateProjectDocument["body"], userId: string) => {
    // 1. Project must exist
    const [prj] = await db.select({ id: project.id }).from(project).where(eq(project.id, projectId));
    if (!prj) throw new AppError(`Project with id ${projectId} not found`, 404);

    // 2. Insert document
    const [doc] = await db
      .insert(projectDocument)
      .values({
        projectId,
        documentType: body.documentType,
        fileName:     body.fileName,
        fileUrl:      body.fileUrl,
        fileSize:     body.fileSize,
        mimeType:     body.mimeType ?? null,
        uploadedBy:   userId,
      })
      .returning();

    return doc;
  },

  listDocuments: async (projectId: string) => {
    return db
      .select()
      .from(projectDocument)
      .where(eq(projectDocument.projectId, projectId));
  },

  verifyDocument: async (docId: string, userId: string) => {
    const [doc] = await db
      .update(projectDocument)
      .set({
        isVerified: true,
        verifiedBy: userId,
        verifiedAt: new Date(),
      })
      .where(eq(projectDocument.id, docId))
      .returning();

    if (!doc) throw new AppError(`Document with id ${docId} not found`, 404);
    return doc;
  },

  deleteDocument: async (docId: string) => {
    const [doc] = await db
      .delete(projectDocument)
      .where(eq(projectDocument.id, docId))
      .returning();

    if (!doc) throw new AppError(`Document with id ${docId} not found`, 404);
    return doc;
  },
};

export default ProjectDocumentService;
