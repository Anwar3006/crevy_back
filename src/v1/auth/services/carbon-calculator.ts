// services/carbon-calculator.ts
import { db } from "@/config/db";
import {
  project,
  projectPractices,
  regenerativePractices,
} from "../models/project-model";
import { eq } from "drizzle-orm";

export const CarbonCalculator = {
  // Updated Calculator Logic
  calculateProjectImpact: async (projectId: string, tx: any = db) => {
    const projectData = await tx.query.project.findFirst({
      where: eq(project.id, projectId),
      with: { projectPractices: true },
    });

    // actualCarbonStored = sum of (hectare * snapshot_impact_factor)
    const annualSequestration = projectData.projectPractices.reduce(
      (acc: any, pp: any) => {
        return (
          acc +
          parseFloat(pp.areaHectare) * parseFloat(pp.impactFactorAtSigning)
        );
      },
      0,
    );

    const baseline = parseFloat(projectData.baselineEmissionsYearly || "0");
    // We should subtract operational emissions (e.g. 10% leakage or a fixed field)
    const projectEmissions = 0;

    const netAnnualImpact = annualSequestration - baseline - projectEmissions;
    const totalLifetimeEstimate =
      netAnnualImpact * (projectData.durationMonths / 12);

    return {
      annualSequestrationEstimate: netAnnualImpact,
      totalLifetimeEstimate: totalLifetimeEstimate, // This is what investors care about
    };
  },
};
