import { z } from "zod";

export const projectOwnerOnboardingSchema = z.object({
  body: z.object({
    // User Table Info
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.preprocess(
      (val) => (val === "" ? null : val),
      z.string().email("Invalid email format").optional().nullable()
    ),
    contactNumber: z.string().min(1, "Contact number is required"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    countryOfOperation: z.string().min(1, "Country is required"),
    
    // Project Owner Table Info
    bankDetails: z.object({
      bankName: z.string(),
      accountNumber: z.string(),
      accountName: z.string().optional(),
    }).optional().nullable(),
    
    momoDetails: z.object({
      network: z.string(),
      number: z.string(),
      accountName: z.string().optional(),
    }).optional().nullable(),

    // Farm Plot Table Info (Optional at registration)
    farmPlot: z.object({
      region: z.string().min(1),
      village: z.string().optional(),
      centroid: z.object({
        lat: z.number(),
        lng: z.number(),
      }),
      areaHectares: z.number(),
    }).optional().nullable(),

    // Assignment Table Info
    partnerId: z.number().optional().nullable(),
    assignmentType: z.enum(["primary", "secondary"]).default("primary"),
    isB2cAssignment: z.boolean().default(false),
  })
});

export type TProjectOwnerOnboarding = z.infer<typeof projectOwnerOnboardingSchema>;
