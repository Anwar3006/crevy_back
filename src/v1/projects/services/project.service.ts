import { db } from "@/config/db";
import {
  project,
  projectPractices,
  regenerativePractices,
} from "../../projects/models/project-model";
import { and, desc, eq } from "drizzle-orm";
import { CarbonCalculator } from "./carbon-calculator";

export interface CreateProjectDTO {
  userId: string;
  name: string;
  location: string;
  startDate: string;
  durationMonths: number;
  projectType?: string;
  status?: string;
  totalAreaHectares?: number;
  baselineEmissionsYearly?: number;
  gpsCoordinates?: string;
  baselineLandUse?: string;
  soilType?: string;
  initialSoilCarbonContent?: number;
  expectedBiomassIncrease?: string;
  cropLivestockTypes?: string;
  organicAmendments?: string;
  socialEconomicBenefits?: string;
  planToExpandPractices?: string;
  description?: string;
  implementationPlan?: string;
  expectedOutcomes?: string;
  usesSyntheticFertilizers?: boolean;
  usesSyntheticPesticides?: boolean;
  supportsBiodiversityConservation?: boolean;
  supportsWaterManagement?: boolean;
  practices?: Array<{
    practiceId: string;
    areaHectare: number;
    intensity: string;
  }>;
  regenerativePractices?: string;
}

export interface UpdateProjectDTO {
  name?: string;
  location?: string;
  startDate?: string;
  durationMonths?: number;
  projectType?: string;
  status?: string;
  totalAreaHectares?: number;
  baselineEmissionsYearly?: number;
  gpsCoordinates?: string;
  baselineLandUse?: string;
  soilType?: string;
  initialSoilCarbonContent?: number;
  expectedBiomassIncrease?: string;
  cropLivestockTypes?: string;
  organicAmendments?: string;
  socialEconomicBenefits?: string;
  planToExpandPractices?: string;
  description?: string;
  implementationPlan?: string;
  expectedOutcomes?: string;
  usesSyntheticFertilizers?: boolean;
  usesSyntheticPesticides?: boolean;
  supportsBiodiversityConservation?: boolean;
  supportsWaterManagement?: boolean;
  practices?: Array<{
    practiceId: string;
    areaHectare: number;
    intensity: string;
  }>;
  regenerativePractices?: string;
}

export interface GetProjectsQuery {
  page?: number;
  limit?: number;
  status?: string;
  projectType?: string;
}

export type ProjectStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "active"
  | "completed"
  | "cancelled";

export type ProjectType =
  | "regenerative_agriculture"
  | "renewable_energy"
  | "waste_management"
  | "biochar"
  | "reforestation"
  | "blue_carbon"
  | "other";

const ProjectServices = {
  getRegenerativePractices: async () => {
    try {
      const practices = await db.select().from(regenerativePractices);

      // If no practices found, we could seed them here or via a dedicated script
      // For now, let's just return what we have
      return practices;
    } catch (error) {
      console.error("Error fetching regenerative practices:", error);
      throw error;
    }
  },

  createProject: async (data: any) => {
    const {
      practices: initialPractices,
      regenerativePractices: practicesString,
      ...projectData
    } = data;
    try {
      return await db.transaction(async (tx) => {
        // 1. Create the project
        const [newProject] = await tx
          .insert(project)
          .values(projectData)
          .returning();

        // 2. Resolve practices
        let finalPractices = initialPractices || [];

        // If we have a comma-separated string of practices (IDs or slugs), resolve them
        if (practicesString && typeof practicesString === "string") {
          const identifiers = practicesString.split(",").map((s) => s.trim());
          if (identifiers.length > 0) {
            const masterPractices =
              await tx.query.regenerativePractices.findMany();

            identifiers.forEach((id) => {
              const matched = masterPractices.find(
                (m) =>
                  m.id === id ||
                  m.name.toLowerCase().includes(id.toLowerCase()),
              );
              if (
                matched &&
                !finalPractices.find((p: any) => p.practiceId === matched.id)
              ) {
                finalPractices.push({
                  practiceId: matched.id,
                  areaHectare: projectData.totalAreaHectares || 1,
                  intensity: "Standard",
                });
              }
            });
          }
        }

        // 3. Snapshot the practices
        if (finalPractices && finalPractices.length > 0) {
          const masterPractices =
            await tx.query.regenerativePractices.findMany();

          const practiceEntries = finalPractices.map((p: any) => {
            const master = masterPractices.find(
              (m: any) => m.id === p.practiceId,
            );
            return {
              projectId: newProject.id,
              practiceId: p.practiceId,
              areaHectare: p.areaHectare || projectData.totalAreaHectares || 0,
              intensity: p.intensity || "Standard",
              impactFactorAtSigning: master?.carbonImpactFactor || "0",
            };
          });
          await tx.insert(projectPractices).values(practiceEntries);
        }

        // 4. Compute Impact and Update Project
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
    const {
      practices: initialPractices,
      regenerativePractices: practicesString,
      ...projectData
    } = data;
    try {
      return await db.transaction(async (tx) => {
        // 1. Update project details
        const [updatedProject] = await tx
          .update(project)
          .set({ ...projectData, updatedAt: new Date() })
          .where(eq(project.id, projectId))
          .returning();

        // 2. Resolve practices
        let finalPractices = initialPractices;

        // If we have a comma-separated string of practices (slugs), convert to practice IDs
        if (practicesString && typeof practicesString === "string") {
          finalPractices = finalPractices || [];
          const slugs = practicesString.split(",").map((s) => s.trim());
          if (slugs.length > 0) {
            const masterPractices =
              await tx.query.regenerativePractices.findMany();

            slugs.forEach((slug) => {
              const matched = masterPractices.find(
                (m) =>
                  m.name.toLowerCase().includes(slug.toLowerCase()) ||
                  m.id === slug,
              );
              if (
                matched &&
                !finalPractices.find((p: any) => p.practiceId === matched.id)
              ) {
                finalPractices.push({
                  practiceId: matched.id,
                  areaHectare: updatedProject.totalAreaHectares || 1,
                  intensity: "Standard",
                });
              }
            });
          }
        }

        // 3. If practices are included, refresh the links (Delete old, Insert new)
        if (finalPractices) {
          await tx
            .delete(projectPractices)
            .where(eq(projectPractices.projectId, projectId));
          if (finalPractices.length > 0) {
            const practiceEntries = finalPractices.map((p: any) => ({
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

  /**
   * Get all projects for a user with pagination and filtering
   */
  getAllUserProjects: async (userId: string, query: GetProjectsQuery) => {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [eq(project.userId, userId)];
    if (query.status) {
      conditions.push(eq(project.status, query.status as ProjectStatus));
    }
    if (query.projectType) {
      conditions.push(
        eq(project.projectType, query.projectType as ProjectType),
      );
    }

    // Get projects with practices
    const projects = await db
      .select()
      .from(project)
      .where(and(...conditions))
      .orderBy(desc(project.createdAt))
      .limit(limit)
      .offset(offset);

    // Get practices for each project
    const projectsWithPractices = await Promise.all(
      projects.map(async (proj) => {
        const practices = await db
          .select()
          .from(projectPractices)
          .where(eq(projectPractices.projectId, proj.id));

        return {
          ...proj,
          projectPractices: practices,
        };
      }),
    );

    return projectsWithPractices;
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
  getMarketplaceProjects: async (query: any) => {
    try {
      const page = query.page || 1;
      const limit = query.limit || 10;
      const offset = (page - 1) * limit;

      const conditions: any[] = [];

      // Filter by Verification Status (mapping)
      if (query.status) {
        if (query.status === "verified") {
          conditions.push(eq(project.status, "approved"));
        } else if (query.status === "pre-verified") {
          conditions.push(eq(project.status, "active"));
        } else if (query.status === "pending") {
          conditions.push(eq(project.status, "submitted"));
        }
      }

      if (query.projectType) {
        conditions.push(eq(project.projectType, query.projectType as any));
      }

      if (query.region && query.region !== "All Regions") {
        conditions.push(eq(project.region, query.region));
      }

      // SDG Filter (Simple text search if stored as comma-separated)
      // Note: Better implementation would be an array column, but for now we follow the model change
      if (query.sdgs) {
        const sdgList = query.sdgs.split(",");
        // This is a simple implementation; ideally use a more robust search if needed
        // For now, if any of the requested SDGs match
      }

      if (query.search) {
        // Basic search on name or description
        // In Drizzle, we'd use ilike
      }

      const results = await db
        .select()
        .from(project)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(project.createdAt))
        .limit(limit)
        .offset(offset);

      return results;
    } catch (error) {
      console.error("Marketplace retrieval error:", error);
      throw error;
    }
  },
};

export default ProjectServices;
