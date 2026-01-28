import { db } from "@/config/db";
import { project, projectPractices } from "../../projects/models/project-model";
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
  | "other";

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
};

export default ProjectServices;
