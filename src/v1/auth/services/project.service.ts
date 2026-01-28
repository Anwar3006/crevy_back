import { db } from "@/config/db";
import { project, projectPractices } from "../models/project-model";
import { eq } from "drizzle-orm";
import { CarbonCalculator } from "./carbon-calculator";

const ProjectServices = {
  createProject: async (data: any) => {
    const { practices, ...projectData } = data;
    try {
      return await db.transaction(async (tx) => {
        // 1. Create the project
        const [newProject] = await tx
          .insert(project)
          .values(projectData)
          .returning();

        // 2. Snapshot the practices
        if (practices && practices.length > 0) {
          // Fetch current master factors to "snapshot" them
          const masterPractices =
            await tx.query.regenerativePractices.findMany();

          const practiceEntries = practices.map((p: any) => {
            const master = masterPractices.find(
              (m: any) => m.id === p.practiceId,
            );
            return {
              projectId: newProject.id,
              practiceId: p.practiceId,
              areaHectare: p.areaHectare,
              intensity: p.intensity,
              // THE SNAPSHOT:
              impactFactorAtSigning: master?.carbonImpactFactor || "0",
            };
          });
          await tx.insert(projectPractices).values(practiceEntries);
        }

        // 3. Compute and Update
        const impact = await CarbonCalculator.calculateProjectImpact(
          newProject.id,
          tx,
        );

        await tx
          .update(project)
          .set({ estimatedTotalTco2e: impact.totalLifetimeEstimate.toString() })
          .where(eq(project.id, newProject.id));

        return { ...newProject, impact };
      });
    } catch (error) {
      console.error("Project creation error:", error);
      throw error;
    }
  },

  updateProject: async (data: any, projectId: string) => {
    const { practices, ...projectData } = data;
    try {
      return await db.transaction(async (tx) => {
        // 1. Update project details
        const [updatedProject] = await tx
          .update(project)
          .set({ ...projectData, updatedAt: new Date() })
          .where(eq(project.id, projectId))
          .returning();

        // 2. If practices are included, refresh the links (Delete old, Insert new)
        if (practices) {
          await tx
            .delete(projectPractices)
            .where(eq(projectPractices.projectId, projectId));
          if (practices.length > 0) {
            const practiceEntries = practices.map((p: any) => ({
              projectId: projectId,
              practiceId: p.practiceId,
              areaHectare: p.areaHectare,
              intensity: p.intensity,
            }));
            await tx.insert(projectPractices).values(practiceEntries);
          }
        }

        return updatedProject;
      });
    } catch (error) {
      console.error("Project updating error:", error);
      throw error;
    }
  },

  getAllUserProjects: async (userId: string) => {
    try {
      // Fetches projects with their practices joined
      return await db.query.project.findMany({
        where: eq(project.userId, userId),
        with: {
          projectPractices: true, // Requires drizzle-orm relational config
        },
      });
    } catch (error) {
      console.error("Error retrieving projects:", error);
      throw error;
    }
  },

  getSingleProject: async (projectId: string) => {
    try {
      const result = await db.query.project.findFirst({
        where: eq(project.id, projectId),
        with: {
          projectPractices: true,
        },
      });
      return result;
    } catch (error) {
      console.error("Error retrieving project:", error);
      throw error;
    }
  },

  deleteProject: async (projectId: string) => {
    try {
      // Due to onDelete: "cascade" in the schema,
      // related practices and documents will be deleted automatically by Postgres
      const result = await db
        .delete(project)
        .where(eq(project.id, projectId))
        .returning();
      return result;
    } catch (error) {
      console.error("Project deletion error:", error);
      throw error;
    }
  },
};
