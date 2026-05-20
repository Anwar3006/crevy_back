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
    
    // Flattened Payload Support (mapped to nested structures)
    bankName: z.string().optional(),
    bankAccountNumber: z.string().optional(),
    bankAccountName: z.string().optional(),

    momoNetwork: z.string().optional(),
    momoNumber: z.string().optional(),
    momoAccountName: z.string().optional(),

    region: z.string().optional(),
    village: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    areaHectares: z.number().optional(),

    // Legacy Nested Support (still supported)
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
  }).transform((data) => {
    // Map flat fields to nested structures if they exist
    if (data.bankName && data.bankAccountNumber) {
      data.bankDetails = {
        bankName: data.bankName,
        accountNumber: data.bankAccountNumber,
        accountName: data.bankAccountName,
      };
    }

    if (data.momoNetwork && data.momoNumber) {
      data.momoDetails = {
        network: data.momoNetwork,
        number: data.momoNumber,
        accountName: data.momoAccountName,
      };
    }

    if (data.region && data.latitude !== undefined && data.longitude !== undefined && data.areaHectares !== undefined) {
      data.farmPlot = {
        region: data.region,
        village: data.village,
        centroid: {
          lat: data.latitude,
          lng: data.longitude,
        },
        areaHectares: data.areaHectares,
      };
    }

    return data;
  })
}).superRefine((data, ctx) => {
  // Cross-field validation validation
  if (!data.body.email && !data.body.contactNumber) {
    ctx.addIssue({
      // FIX: Changed from z.ZodIssueCode.custom to the raw string literal
      code: "custom",
      message: "Either Email or Contact Number must be provided to create an account",
      path: ["body", "email"],
    });
  }
});

export type TProjectOwnerOnboarding = z.infer<typeof projectOwnerOnboardingSchema>;