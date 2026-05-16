// src/v2/parent-model.ts
// All Drizzle models exported from a single barrel.
// drizzle.config.ts points here.

// Auth + RBAC
export * from './rbac/models/rbac.model'
export * from './auth/models/auth.model'
export * from './deps/models/currency.model'

// Partners
export * from './partners/models/partner.model'

// Project Owners
export * from './project_owners/models/project_owner.model'
export * from './project_owners/models/farm_plot.model'
export * from './project_owners/models/project_owner_assignment.model'

// Projects
export * from './projects/models/project.model'
export * from './projects/models/project-owner_enrollment.model'
export * from './projects/models/project-plot.model'
export * from './projects/models/project_activity.model'
export * from './projects/models/project_docs.model'

// MRV
export * from './mrv/models/mrv_ingestion.model'
export * from './mrv/models/mrv_verification.model'
export * from './mrv/models/mrv_blockchain.model'

// Credits
export * from './credits/models/carbon_credit.model'
export * from './credits/models/credit_transaction.model'
export * from './credits/models/verification.model'

// Financials
export * from './financials/models/payout.model'
export * from './financials/models/financial_record.model'
export * from './financials/models/contract.model'
