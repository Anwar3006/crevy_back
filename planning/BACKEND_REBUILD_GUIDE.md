# Crevy Backend v2 — Complete Rebuild Guide
### For the engineering team at Foovante Global

> **Document Status:** Implementation-Ready  
> **Architecture:** MVC (Route → Controller → Service → Database)  
> **Methodology:** Test-Driven Development (TDD) with Vitest  
> **Database:** PostgreSQL 16 + PostGIS · ORM: Drizzle  
> **Auth:** better-auth v1  
> **API Prefix:** `/api/v2`

---

## Table of Contents

1. [Strategy: Branch & Migration Plan](#1-strategy-branch--migration-plan)
2. [Technology Stack & Rationale](#2-technology-stack--rationale)
3. [Environment Setup](#3-environment-setup)
4. [Project & Directory Structure](#4-project--directory-structure)
5. [Core Configuration Files](#5-core-configuration-files)
6. [Database Layer — Drizzle Models](#6-database-layer--drizzle-models)
7. [Module 1: RBAC (Roles & Permissions)](#7-module-1-rbac-roles--permissions)
8. [Module 2: Auth & Users](#8-module-2-auth--users)
9. [Module 3: Partners](#9-module-3-partners)
10. [Module 4: Farmer Management](#10-module-4-farmer-management)
11. [Module 5: Project Management](#11-module-5-project-management)
12. [Module 6: MRV Pipeline](#12-module-6-mrv-pipeline)
13. [Module 7: Carbon Credits & Transactions](#13-module-7-carbon-credits--transactions)
14. [Module 8: Financials](#14-module-8-financials)
15. [Module 9: Audit, Notifications & Health](#15-module-9-audit-notifications--health)
16. [Middleware Reference](#16-middleware-reference)
17. [TDD Strategy — How to Write Tests](#17-tdd-strategy--how-to-write-tests)
18. [Complete API Endpoint Reference](#18-complete-api-endpoint-reference)
19. [Database Migrations & Seeding](#19-database-migrations--seeding)
20. [Environment Variables](#20-environment-variables)
21. [Frontend Handoff Checklist](#21-frontend-handoff-checklist)
22. [Progress Tracker](#22-progress-tracker)

---

## 1. Strategy: Branch & Migration Plan

### Why a new branch, not a v2 folder

The SQL redesign (`DB_Redesign.sql`) introduces 25 tables, PostGIS extensions, and an entirely new relationship map. Trying to evolve v1 in-place while keeping it working would create weeks of merge conflicts and unstable intermediate states. A clean branch is the right call.

### Git strategy

```bash
# From the main branch, create and switch to the new branch
git checkout -b feat/v2-backend-redesign

# Do ALL v2 development on this branch.
# When v2 is complete and tested, merge into main and delete the old src/v1 folder.
# Never delete v1 until v2 passes ALL tests and has been smoke-tested in staging.
```

### What to keep from v1 (do not rewrite from scratch)

| v1 Asset | Decision | Reason |
|---|---|---|
| `src/index.ts` — Express app bootstrap | ✅ Keep, minor edits | CORS config, middleware order, and better-auth proxy setup are correct |
| `src/config/db.ts` | ✅ Keep | Drizzle connection setup is correct |
| `src/config/settings.ts` | ✅ Keep | Settings class pattern is solid |
| `src/shared/errors/AppError.ts` | ✅ Keep | Unchanged |
| `src/shared/errors/errorHandler.ts` | ✅ Keep | Unchanged |
| `src/middleware/auth.middleware.ts` | ✅ Keep | `requireAuth` and `optionalAuth` work correctly with better-auth |
| `src/middleware/validateInboundRequest.middleware.ts` | ✅ Keep | Zod validation middleware is correct |
| `src/shared/utils/auth.ts` | ✅ Keep, extend | better-auth config is mostly correct, extend `additionalFields` |
| `drizzle.config.ts` | ✅ Keep, update schema path | Point to new schema barrel |
| `package.json` | ✅ Keep, add vitest | Add test dependencies |

### What to delete / replace

Everything under `src/v1/` is replaced by `src/v2/`. The v1 folder stays untouched until v2 is merged.

---

## 2. Technology Stack & Rationale

| Concern | Tool | Why |
|---|---|---|
| HTTP Framework | **Express v5** | Already in use, team familiar, async error propagation improved in v5 |
| Language | **TypeScript 5** | Type safety, better DX, already configured |
| ORM | **Drizzle ORM** | Type-safe SQL-first, migrations via `drizzle-kit`, already in use |
| Database | **PostgreSQL 16 + PostGIS** | Required for `GEOGRAPHY` types (farm plot boundaries, sensor geo-fencing) |
| Auth | **better-auth v1** | Already integrated, handles sessions/OAuth/password hashing correctly |
| Validation | **Zod v4** | Schema validation for request bodies and external payloads (CraftedClimate webhooks) |
| Testing | **Vitest** | Vite-native, ESM-compatible (project uses `"type": "module"`), fast, excellent TypeScript support |
| Test HTTP | **Supertest** | Industry standard for Express endpoint testing |
| Test DB | **In-memory / Test DB** | Separate `TEST_DATABASE_URL` pointing to a test PostgreSQL schema |
| Logging | **Pino** | Structured JSON logging, already in use |
| File Uploads | **Multer** | Already in use for document uploads |
| Code Style | **Biome** | Already configured |

### Why Vitest over Jest

The project uses `"type": "module"` in `package.json`. Jest requires significant configuration to work with native ESM. Vitest works with ESM natively, requires zero config, and is 5–10x faster in watch mode.

---

## 3. Environment Setup

### 3.1 Install new dependencies

```bash
# Test runner + HTTP testing
pnpm add -D vitest @vitest/coverage-v8 supertest @types/supertest

# PostGIS support — pg already installed, just need the types
# No new runtime dep needed; PostGIS is a Postgres extension

# If not already installed:
pnpm add zod drizzle-zod
```

### 3.2 Add vitest config

Create `vitest.config.ts` in the project root:

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['node_modules', 'drizzle', 'dist'],
    },
    // Run tests serially to avoid DB conflicts
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@config': path.resolve(__dirname, './src/config'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@v2': path.resolve(__dirname, './src/v2'),
    },
  },
})
```

### 3.3 Add test scripts to package.json

```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "test:ui": "vitest --ui"
}
```

### 3.4 Test setup file

Create `src/tests/setup.ts`:

```typescript
// src/tests/setup.ts
import { beforeAll, afterAll } from 'vitest'
import { db } from '@config/db'
import { sql } from 'drizzle-orm'

beforeAll(async () => {
  // Run any global setup (ensure test DB is clean, run migrations)
  // Each module's test file will handle its own table setup/teardown
})

afterAll(async () => {
  // Clean up any dangling connections
})
```

### 3.5 PostgreSQL with PostGIS (local)

```bash
# macOS with Homebrew
brew install postgresql@16
brew install postgis

# Create databases
createdb crevy_dev
createdb crevy_test

# Enable PostGIS on both
psql crevy_dev -c "CREATE EXTENSION IF NOT EXISTS postgis;"
psql crevy_dev -c "CREATE EXTENSION IF NOT EXISTS btree_gist;"
psql crevy_test -c "CREATE EXTENSION IF NOT EXISTS postgis;"
psql crevy_test -c "CREATE EXTENSION IF NOT EXISTS btree_gist;"
```

---

## 4. Project & Directory Structure

The new structure mirrors the domain-driven design of the SQL schema. Each domain (auth, farmers, projects, mrv, credits, financials) lives in its own folder under `src/v2/`.

```
crevy-backend/
├── src/
│   ├── config/                    # DB, logger, settings — UNCHANGED from v1
│   │   ├── db.ts
│   │   ├── env.ts
│   │   ├── logger.ts
│   │   └── settings.ts
│   │
│   ├── middleware/                # UNCHANGED from v1
│   │   ├── auth.middleware.ts
│   │   └── validateInboundRequest.middleware.ts
│   │
│   ├── shared/                    # UNCHANGED from v1
│   │   ├── errors/
│   │   │   ├── AppError.ts
│   │   │   └── errorHandler.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   └── utils/
│   │       └── auth.ts
│   │
│   ├── tests/
│   │   └── setup.ts
│   │
│   ├── v1/                        # DO NOT TOUCH — live until v2 is merged
│   │
│   └── v2/
│       ├── schema.ts              # Barrel — exports all Drizzle models for drizzle-kit
│       ├── index.ts               # v2Router — mounts all sub-routers
│       │
│       ├── rbac/                  # Roles, Permissions
│       │   ├── models/
│       │   │   └── rbac.model.ts
│       │   ├── schema/
│       │   │   └── rbac.schema.ts
│       │   ├── services/
│       │   │   └── rbac.service.ts
│       │   ├── controllers/
│       │   │   └── rbac.controller.ts
│       │   ├── routes/
│       │   │   └── rbac.route.ts
│       │   └── tests/
│       │       └── rbac.test.ts
│       │
│       ├── auth/                  # User + better-auth + Currency
│       │   ├── models/
│       │   │   ├── user.model.ts
│       │   │   └── currency.model.ts
│       │   ├── schema/
│       │   │   └── auth.schema.ts
│       │   ├── services/
│       │   │   └── auth.service.ts
│       │   ├── controllers/
│       │   │   └── auth.controller.ts
│       │   ├── routes/
│       │   │   └── auth.route.ts
│       │   └── tests/
│       │       └── auth.test.ts
│       │
│       ├── partners/
│       │   ├── models/
│       │   │   └── partner.model.ts
│       │   ├── schema/
│       │   │   └── partner.schema.ts
│       │   ├── services/
│       │   │   └── partner.service.ts
│       │   ├── controllers/
│       │   │   └── partner.controller.ts
│       │   ├── routes/
│       │   │   └── partner.route.ts
│       │   └── tests/
│       │       └── partner.test.ts
│       │
│       ├── farmers/
│       │   ├── models/
│       │   │   ├── farmer.model.ts
│       │   │   ├── farm-plot.model.ts
│       │   │   └── farmer-assignment.model.ts
│       │   ├── schema/
│       │   │   └── farmer.schema.ts
│       │   ├── services/
│       │   │   └── farmer.service.ts
│       │   ├── controllers/
│       │   │   └── farmer.controller.ts
│       │   ├── routes/
│       │   │   └── farmer.route.ts
│       │   └── tests/
│       │       └── farmer.test.ts
│       │
│       ├── projects/
│       │   ├── models/
│       │   │   ├── project.model.ts
│       │   │   ├── project-farmer.model.ts
│       │   │   ├── project-plot.model.ts
│       │   │   └── project-activity.model.ts
│       │   ├── schema/
│       │   │   └── project.schema.ts
│       │   ├── services/
│       │   │   └── project.service.ts
│       │   ├── controllers/
│       │   │   └── project.controller.ts
│       │   ├── routes/
│       │   │   └── project.route.ts
│       │   └── tests/
│       │       └── project.test.ts
│       │
│       ├── mrv/
│       │   ├── models/
│       │   │   ├── mrv-ingestion.model.ts
│       │   │   ├── mrv-verification.model.ts
│       │   │   └── mrv-blockchain.model.ts
│       │   ├── schema/
│       │   │   └── mrv.schema.ts
│       │   ├── services/
│       │   │   └── mrv.service.ts
│       │   ├── controllers/
│       │   │   └── mrv.controller.ts
│       │   ├── routes/
│       │   │   └── mrv.route.ts
│       │   └── tests/
│       │       └── mrv.test.ts
│       │
│       ├── credits/
│       │   ├── models/
│       │   │   ├── carbon-credit.model.ts
│       │   │   ├── credit-transaction.model.ts
│       │   │   └── verification.model.ts
│       │   ├── schema/
│       │   │   └── credit.schema.ts
│       │   ├── services/
│       │   │   └── credit.service.ts
│       │   ├── controllers/
│       │   │   └── credit.controller.ts
│       │   ├── routes/
│       │   │   └── credit.route.ts
│       │   └── tests/
│       │       └── credit.test.ts
│       │
│       └── financials/
│           ├── models/
│           │   ├── payout.model.ts
│           │   ├── financial-record.model.ts
│           │   └── contract.model.ts
│           ├── schema/
│           │   └── financial.schema.ts
│           ├── services/
│           │   └── financial.service.ts
│           ├── controllers/
│           │   └── financial.controller.ts
│           ├── routes/
│           │   └── financial.route.ts
│           └── tests/
│               └── financial.test.ts
│
├── drizzle/                       # Auto-generated migration files
├── planning/
│   ├── DB_Redesign.sql
│   └── BACKEND_REBUILD_GUIDE.md   ← this file
├── drizzle.config.ts
├── vitest.config.ts
└── package.json
```

---

## 5. Core Configuration Files

### 5.1 `src/v2/index.ts` — The v2 Router

```typescript
// src/v2/index.ts
import express from 'express'
import { authRouter } from './auth/routes/auth.route'
import { rbacRouter } from './rbac/routes/rbac.route'
import { partnerRouter } from './partners/routes/partner.route'
import { farmerRouter } from './farmers/routes/farmer.route'
import { projectRouter } from './projects/routes/project.route'
import { mrvRouter } from './mrv/routes/mrv.route'
import { creditRouter } from './credits/routes/credit.route'
import { financialRouter } from './financials/routes/financial.route'

const v2Router = express.Router()

v2Router.use('/auth', authRouter)
v2Router.use('/rbac', rbacRouter)
v2Router.use('/partners', partnerRouter)
v2Router.use('/farmers', farmerRouter)
v2Router.use('/projects', projectRouter)
v2Router.use('/mrv', mrvRouter)
v2Router.use('/credits', creditRouter)
v2Router.use('/financials', financialRouter)

export default v2Router
```

### 5.2 Mount v2Router in `src/index.ts`

Add alongside v1 (do NOT remove v1 yet):

```typescript
// In src/index.ts — ADD these two lines alongside existing v1 mount
import v2Router from '@v2/index'
app.use('/api/v2', v2Router)
```

### 5.3 `src/v2/schema.ts` — Drizzle barrel export

```typescript
// src/v2/schema.ts
// All Drizzle models exported from a single barrel.
// drizzle.config.ts points here.

// Auth + RBAC
export * from './rbac/models/rbac.model'
export * from './auth/models/user.model'
export * from './auth/models/currency.model'

// Partners
export * from './partners/models/partner.model'

// Farmers
export * from './farmers/models/farmer.model'
export * from './farmers/models/farm-plot.model'
export * from './farmers/models/farmer-assignment.model'

// Projects
export * from './projects/models/project.model'
export * from './projects/models/project-farmer.model'
export * from './projects/models/project-plot.model'
export * from './projects/models/project-activity.model'

// MRV
export * from './mrv/models/mrv-ingestion.model'
export * from './mrv/models/mrv-verification.model'
export * from './mrv/models/mrv-blockchain.model'

// Credits
export * from './credits/models/carbon-credit.model'
export * from './credits/models/credit-transaction.model'
export * from './credits/models/verification.model'

// Financials
export * from './financials/models/payout.model'
export * from './financials/models/financial-record.model'
export * from './financials/models/contract.model'
```

### 5.4 Update `drizzle.config.ts`

```typescript
// drizzle.config.ts — update schema path to point to v2
export default defineConfig({
  out: './drizzle',
  schema: './src/v2/schema.ts',  // ← changed from v1
  casing: 'snake_case',
  dialect: 'postgresql',
  dbCredentials: { url: databaseUrl },
})
```

---

## 6. Database Layer — Drizzle Models

Each SQL table from `DB_Redesign.sql` maps to a Drizzle TypeScript model. Below is the complete implementation for each. Study the SQL comments alongside each model — they explain WHY each field exists.

> **Drizzle conventions used throughout:**
> - All PKs are `uuid().primaryKey().defaultRandom()` unless the SQL specifies SERIAL (use `serial()`)
> - All FK references use `references(() => targetTable.id, { onDelete: 'cascade' | 'restrict' | 'setNull' })`
> - Timestamps: `timestamp({ withTimezone: true })` maps to `TIMESTAMPTZ`
> - Enums: defined with `pgEnum()` at the top of each model file

---

### 6.1 RBAC Models (`src/v2/rbac/models/rbac.model.ts`)

```typescript
import { pgTable, pgEnum, serial, varchar, text, boolean, timestamp, integer, primaryKey } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ─── ENUMS ────────────────────────────────────────────────────────────────────
export const assignmentTypeEnum = pgEnum('assignment_type_enum', ['primary', 'secondary'])

// ─── TABLES ───────────────────────────────────────────────────────────────────

/**
 * role
 * Named roles on the platform: farmer, company_buyer, admin, verifier, partner_agent.
 * Decoupled from users — add new roles without schema changes to user table.
 */
export const role = pgTable('role', {
  id:          serial('id').primaryKey(),
  name:        varchar('name', { length: 50 }).notNull().unique(),
  description: varchar('description', { length: 255 }),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * permission
 * Defines resource-action pairs: e.g. resource='projects', action='approve'.
 * UNIQUE(resource, action) prevents duplicate permission rows.
 */
export const permission = pgTable('permission', {
  id:          serial('id').primaryKey(),
  resource:    varchar('resource', { length: 100 }).notNull(),
  action:      varchar('action', { length: 100 }).notNull(),
  description: varchar('description', { length: 255 }),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueResourceAction: { columns: [t.resource, t.action] }
}))

/**
 * role_permission
 * Many-to-many bridge between role and permission.
 * Composite PK (role_id, permission_id) prevents duplicates.
 * Changing what a role can do is a DATA change, not a code deployment.
 */
export const rolePermission = pgTable('role_permission', {
  roleId:       integer('role_id').notNull().references(() => role.id, { onDelete: 'cascade' }),
  permissionId: integer('permission_id').notNull().references(() => permission.id, { onDelete: 'cascade' }),
  grantedBy:    text('granted_by'), // FK to user.id — set at app layer
  grantedAt:    timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.roleId, t.permissionId] }),
}))

/**
 * user_role
 * Assigns one or more roles to a user. Supports time-limited assignments (future use).
 * UNIQUE(user_id, role_id) prevents assigning the same role twice.
 */
export const userRole = pgTable('user_role', {
  id:         serial('id').primaryKey(),
  userId:     text('user_id').notNull(), // FK to user.id — set at app layer
  roleId:     integer('role_id').notNull().references(() => role.id, { onDelete: 'cascade' }),
  assignedBy: text('assigned_by'),
  assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
  isActive:   boolean('is_active').notNull().default(true),
}, (t) => ({
  uniqueUserRole: { columns: [t.userId, t.roleId] }
}))

// ─── RELATIONS ─────────────────────────────────────────────────────────────
export const roleRelations = relations(role, ({ many }) => ({
  rolePermissions: many(rolePermission),
  userRoles:       many(userRole),
}))

export const permissionRelations = relations(permission, ({ many }) => ({
  rolePermissions: many(rolePermission),
}))

export const rolePermissionRelations = relations(rolePermission, ({ one }) => ({
  role:       one(role,       { fields: [rolePermission.roleId],       references: [role.id] }),
  permission: one(permission, { fields: [rolePermission.permissionId], references: [permission.id] }),
}))
```

---

### 6.2 Auth Models

**`src/v2/auth/models/currency.model.ts`**

```typescript
import { pgTable, serial, char, varchar, timestamp } from 'drizzle-orm/pg-core'

/**
 * currency
 * ISO 4217 reference table. Every monetary field in the system links here.
 * Seeded on migration: USD, GHS, EUR, KES, NGN, ZAR.
 */
export const currency = pgTable('currency', {
  id:        serial('id').primaryKey(),
  code:      char('code', { length: 3 }).notNull().unique(),   // e.g. USD, GHS
  name:      varchar('name', { length: 50 }).notNull().unique(), // e.g. US Dollar
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
```

**`src/v2/auth/models/user.model.ts`**

```typescript
import { pgTable, text, boolean, timestamp, integer, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { currency } from './currency.model'
import { farmer } from '../../farmers/models/farmer.model'

/**
 * user
 * Managed by better-auth. The id, email, emailVerified, image, name, createdAt,
 * updatedAt fields are required by better-auth's drizzle adapter.
 * Additional business fields are added as better-auth additionalFields.
 *
 * NOTE: Do NOT add role logic here. Roles live in user_role table.
 */
export const user = pgTable('user', {
  // better-auth required fields — do not rename or remove
  id:            text('id').primaryKey(),
  name:          text('name').notNull(),
  email:         text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image:         text('image'),
  createdAt:     timestamp('created_at').notNull().defaultNow(),
  updatedAt:     timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),

  // Business fields
  firstName:         text('first_name').notNull(),
  lastName:          text('last_name').notNull(),
  contactNumber:     text('contact_number'),
  countryOfOperation: text('country_of_operation'),
  defaultCurrencyId: integer('default_currency_id').references(() => currency.id, { onDelete: 'set null' }),
  isActive:          boolean('is_active').notNull().default(true),
  profileCompleted:  boolean('profile_completed').notNull().default(false),
  deletedAt:         timestamp('deleted_at'),   // soft delete
}, (t) => [
  index('idx_user_email').on(t.email),
])

// better-auth required tables (session, account, verification) stay the same as v1
// Copy them directly from src/v1/auth/models/auth-model.ts — they do not change.
export { session, account, verification } from '../../v1-compat/auth-tables'
// ↑ OR simply copy-paste the session/account/verification table definitions here

export const userRelations = relations(user, ({ one, many }) => ({
  currency: one(currency, { fields: [user.defaultCurrencyId], references: [currency.id] }),
  farmer:   one(farmer,   { fields: [user.id], references: [farmer.userId] }),
}))
```

> **Note on better-auth tables:** `session`, `account`, and `verification` tables must remain exactly as defined in v1 (the column names and types are dictated by better-auth's drizzle adapter). Copy them into the v2 auth models without modification.

---

### 6.3 Partner Model (`src/v2/partners/models/partner.model.ts`)

```typescript
import { pgTable, pgEnum, serial, varchar, text, boolean, timestamp, integer } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { currency } from '../../auth/models/currency.model'

export const partnerTypeEnum   = pgEnum('partner_type_enum',   ['dMRV_provider', 'auditing_body', 'registry', 'channel'])
export const partnerStatusEnum = pgEnum('partner_status_enum', ['pending', 'approved', 'suspended', 'rejected'])

/**
 * partner
 * External organisations: CraftedClimate (dMRV provider), auditing bodies,
 * certification registries, and channel partners who onboard farmers.
 * CraftedClimate must be seeded as the first record after migration.
 */
export const partner = pgTable('partner', {
  id:                       serial('id').primaryKey(),
  name:                     varchar('name', { length: 255 }).notNull().unique(),
  code:                     varchar('code', { length: 50 }).unique(),
  partnerType:              partnerTypeEnum('partner_type').notNull(),
  contactPerson:            text('contact_person').notNull(),
  contactEmail:             text('contact_email').notNull(),
  contactPhone:             varchar('contact_phone', { length: 50 }),
  country:                  varchar('country', { length: 100 }),
  status:                   partnerStatusEnum('status').notNull().default('pending'),
  defaultCurrencyId:        integer('default_currency_id').references(() => currency.id, { onDelete: 'set null' }),
  hasDataSharingAgreement:  boolean('has_data_sharing_agreement').notNull().default(false),
  createdAt:                timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const partnerRelations = relations(partner, ({ one }) => ({
  currency: one(currency, { fields: [partner.defaultCurrencyId], references: [currency.id] }),
}))
```

---

### 6.4 Farmer Models

**`src/v2/farmers/models/farmer.model.ts`**

```typescript
import { pgTable, pgEnum, uuid, text, varchar, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { user } from '../../auth/models/user.model'

export const farmerVerificationStatusEnum = pgEnum('farmer_verification_status_enum', ['pending', 'verified', 'rejected'])

/**
 * farmer
 * Extended profile for users whose role is project owner / farmer.
 * 1-to-1 with user (one user can have one farmer profile).
 * Stores KYC status and payment channel details for payout disbursement.
 * code format: FRM-GH-000001 — generated by the application layer.
 */
export const farmer = pgTable('farmer', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  userId:             text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  code:               varchar('code', { length: 50 }).notNull().unique(),
  verificationStatus: farmerVerificationStatusEnum('verification_status').notNull().default('pending'),
  onboardedBy:        text('onboarded_by').references(() => user.id, { onDelete: 'set null' }),
  onboardedAt:        timestamp('onboarded_at', { withTimezone: true }).notNull().defaultNow(),
  bankName:           varchar('bank_name', { length: 100 }),
  bankAccountNumber:  varchar('bank_account_number', { length: 50 }),
  mobileMoneyNumber:  varchar('mobile_money_number', { length: 50 }),
  createdAt:          timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:          timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
})

export const farmerRelations = relations(farmer, ({ one }) => ({
  user: one(user, { fields: [farmer.userId], references: [user.id] }),
}))
```

**`src/v2/farmers/models/farm-plot.model.ts`**

```typescript
import { pgTable, pgEnum, uuid, varchar, decimal, boolean, timestamp, index, customType } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { farmer } from './farmer.model'

export const boundaryCollectionMethodEnum = pgEnum('boundary_collection_method_enum', [
  'walked_gps', 'drawn_mobile', 'drawn_web', 'satellite_derived', 'buffered_centroid'
])

/**
 * GEOGRAPHY custom type for PostGIS.
 * Drizzle does not have a built-in PostGIS type, so we define it as a custom SQL type.
 * The value stored is the raw WKT string (e.g. "POINT(-0.342119 6.124582)").
 * Your application layer sends WKT or GeoJSON; PostGIS converts on insert.
 */
const geographyPoint = customType<{ data: string }>({
  dataType() { return 'GEOGRAPHY(Point, 4326)' },
})

const geographyPolygon = customType<{ data: string | null }>({
  dataType() { return 'GEOGRAPHY(Polygon, 4326)' },
})

/**
 * farm_plot
 * A physically distinct parcel of land owned or managed by a farmer.
 * centroid: required at registration — easy to capture from phone GPS.
 * boundary: nullable at registration, required before dMRV submission.
 * boundary_collection_method: records how the boundary was captured for data quality scoring.
 * 'buffered_centroid' method = low confidence, blocks dMRV submission.
 *
 * PostGIS spatial indexes on centroid and boundary are defined in DB_Redesign.sql
 * and will be created by running the SQL file directly (Drizzle kit does not generate GIST indexes).
 */
export const farmPlot = pgTable('farm_plot', {
  id:                       uuid('id').primaryKey().defaultRandom(),
  farmerId:                 uuid('farmer_id').notNull().references(() => farmer.id, { onDelete: 'cascade' }),
  country:                  varchar('country', { length: 100 }).notNull(),
  region:                   varchar('region', { length: 100 }).notNull(),
  village:                  varchar('village', { length: 100 }),
  centroid:                 geographyPoint('centroid').notNull(),
  boundary:                 geographyPolygon('boundary'),
  boundaryCollectionMethod: boundaryCollectionMethodEnum('boundary_collection_method'),
  areaHectares:             decimal('area_hectares', { precision: 10, scale: 2 }).notNull(),
  boundaryVerified:         boolean('boundary_verified').notNull().default(false),
  createdAt:                timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:                timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index('idx_farm_plot_farmer_id').on(t.farmerId),
  // GIST indexes for spatial queries — created manually from DB_Redesign.sql
  // idx_farm_plot_boundary ON farm_plot USING GIST (boundary)
  // idx_farm_plot_centroid  ON farm_plot USING GIST (centroid)
])

export const farmPlotRelations = relations(farmPlot, ({ one }) => ({
  farmer: one(farmer, { fields: [farmPlot.farmerId], references: [farmer.id] }),
}))
```

**`src/v2/farmers/models/farmer-assignment.model.ts`**

```typescript
import { pgTable, uuid, text, integer, boolean, timestamp, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { farmer } from './farmer.model'
import { partner } from '../../partners/models/partner.model'
import { assignmentTypeEnum } from '../../rbac/models/rbac.model'

/**
 * farmer_assignment
 * Links a farmer to a Crevy field agent and optionally to a partner organisation.
 * assignment_type = 'primary' means this agent is the main point of contact.
 * is_b2c_assignment = TRUE: Crevy onboarded directly (partner_id will be NULL).
 * is_b2c_assignment = FALSE: partner-mediated onboarding (partner_id must be set).
 * Only one PRIMARY assignment per farmer at a time — enforced at the application layer.
 */
export const farmerAssignment = pgTable('farmer_assignment', {
  id:              uuid('id').primaryKey().defaultRandom(),
  farmerId:        uuid('farmer_id').notNull().references(() => farmer.id, { onDelete: 'cascade' }),
  agentId:         text('agent_id').notNull(),   // FK → user.id (set at app layer)
  assignedBy:      text('assigned_by').notNull(), // FK → user.id
  partnerId:       integer('partner_id').references(() => partner.id, { onDelete: 'set null' }),
  assignmentType:  assignmentTypeEnum('assignment_type').notNull(),
  isB2cAssignment: boolean('is_b2c_assignment').notNull().default(false),
  isActive:        boolean('is_active').notNull().default(true),
  assignedAt:      timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index('idx_farmer_assignment_farmer_id').on(t.farmerId),
  index('idx_farmer_assignment_agent_id').on(t.agentId),
])

export const farmerAssignmentRelations = relations(farmerAssignment, ({ one }) => ({
  farmer:  one(farmer,  { fields: [farmerAssignment.farmerId],  references: [farmer.id] }),
  partner: one(partner, { fields: [farmerAssignment.partnerId], references: [partner.id] }),
}))
```

---

### 6.5 Project Models

**`src/v2/projects/models/project.model.ts`**

```typescript
import { pgTable, pgEnum, uuid, varchar, text, date, integer, timestamp, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { currency } from '../../auth/models/currency.model'

export const projectTypeEnum   = pgEnum('project_type_enum',   ['regenerative_agriculture', 'reforestation', 'renewable_energy', 'biochar', 'blue_carbon', 'waste_management'])
export const projectStageEnum  = pgEnum('project_stage_enum',  ['registration', 'active', 'verification', 'completed'])
export const projectStatusEnum = pgEnum('project_status_enum', ['draft', 'active', 'suspended', 'closed'])

/**
 * project
 * The core entity. project.code maps to CraftedClimate's CC-PROJECT-ID namespace.
 * This is the join key between Crevy's database and CraftedClimate's dMRV payloads.
 * Code format: PRJ-GH-2026-001 — generated by the application layer.
 */
export const project = pgTable('project', {
  id:            uuid('id').primaryKey().defaultRandom(),
  code:          varchar('code', { length: 100 }).notNull().unique(),
  name:          varchar('name', { length: 255 }).notNull(),
  projectType:   projectTypeEnum('project_type').notNull(),
  projectStage:  projectStageEnum('project_stage').notNull().default('registration'),
  projectStatus: projectStatusEnum('project_status').notNull().default('draft'),
  region:        varchar('region', { length: 100 }).notNull(),
  country:       varchar('country', { length: 100 }).notNull(),
  startDate:     date('start_date').notNull(),
  endDate:       date('end_date'),
  currencyId:    integer('currency_id').notNull().references(() => currency.id, { onDelete: 'restrict' }),
  createdBy:     text('created_by').notNull(),  // FK → user.id
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:     timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index('idx_project_type').on(t.projectType),
  index('idx_project_status').on(t.projectStatus),
  index('idx_project_code').on(t.code),
])

export const projectRelations = relations(project, ({ one }) => ({
  currency: one(currency, { fields: [project.currencyId], references: [currency.id] }),
}))
```

**`src/v2/projects/models/project-farmer.model.ts`**

```typescript
import { pgTable, pgEnum, uuid, date, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { project } from './project.model'
import { farmer } from '../../farmers/models/farmer.model'

export const projectParticipationStatusEnum = pgEnum('project_participation_status_enum', ['active', 'suspended', 'withdrawn'])

/**
 * project_farmer
 * M-to-M join: tracks farmer enrollment in a project.
 * UNIQUE(project_id, farmer_id) — a farmer can only enroll once per project.
 * Land area is NOT stored here — derive it from project_plot.enrolled_area_hectares.
 */
export const projectFarmer = pgTable('project_farmer', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  projectId:            uuid('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
  farmerId:             uuid('farmer_id').notNull().references(() => farmer.id,  { onDelete: 'cascade' }),
  joinedDate:           date('joined_date').notNull(),
  participationStatus:  projectParticipationStatusEnum('participation_status').notNull().default('active'),
  createdAt:            timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:            timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
})

export const projectFarmerRelations = relations(projectFarmer, ({ one }) => ({
  project: one(project, { fields: [projectFarmer.projectId], references: [project.id] }),
  farmer:  one(farmer,  { fields: [projectFarmer.farmerId],  references: [farmer.id] }),
}))
```

**`src/v2/projects/models/project-plot.model.ts`**

```typescript
import { pgTable, pgEnum, uuid, decimal, date, text, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { project } from './project.model'
import { farmPlot } from '../../farmers/models/farm-plot.model'

export const projectPlotStatusEnum = pgEnum('project_plot_status_enum', ['enrolled', 'suspended', 'removed'])

/**
 * project_plot
 * Records which specific farm plots are enrolled in a project.
 * Fills the normalisation gap between project and farm_plot:
 *   project_farmer → which farmers?
 *   project_plot   → which specific land parcels?
 * enrolled_area_hectares may be < farm_plot.area_hectares (farmer enrolls only part of a plot).
 * The carbon calculation uses enrolled_area_hectares — NOT the total registered plot area.
 *
 * CRITICAL CONSTRAINT: idx_project_plot_no_double_enrollment
 * A plot can only be 'enrolled' in ONE project at a time.
 * This UNIQUE partial index is defined in DB_Redesign.sql Section 4.
 * Run the SQL file directly to create it — drizzle-kit does not generate partial unique indexes.
 */
export const projectPlot = pgTable('project_plot', {
  id:                    uuid('id').primaryKey().defaultRandom(),
  projectId:             uuid('project_id').notNull().references(() => project.id,   { onDelete: 'cascade' }),
  plotId:                uuid('plot_id').notNull().references(() => farmPlot.id, { onDelete: 'restrict' }),
  enrolledAreaHectares:  decimal('enrolled_area_hectares', { precision: 10, scale: 2 }).notNull(),
  status:                projectPlotStatusEnum('status').notNull().default('enrolled'),
  enrolledDate:          date('enrolled_date').notNull(),
  removedDate:           date('removed_date'),
  notes:                 text('notes'),
  createdAt:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:             timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
})

export const projectPlotRelations = relations(projectPlot, ({ one }) => ({
  project:  one(project,  { fields: [projectPlot.projectId], references: [project.id] }),
  farmPlot: one(farmPlot, { fields: [projectPlot.plotId],    references: [farmPlot.id] }),
}))
```

**`src/v2/projects/models/project-activity.model.ts`**

```typescript
import { pgTable, pgEnum, serial, uuid, varchar, date, text, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { project } from './project.model'

export const projectActivityStatusEnum = pgEnum('project_activity_status_enum', ['planned', 'in_progress', 'completed', 'skipped', 'rejected'])

/**
 * project_activity
 * Time-stamped operational milestones: sensor installation, soil sampling,
 * tree planting, auditor site visit, etc.
 * Feeds the "Track Verification" dashboard feature.
 */
export const projectActivity = pgTable('project_activity', {
  id:                  serial('id').primaryKey(),
  projectId:           uuid('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
  name:                varchar('name', { length: 100 }).notNull(),
  activityDate:        date('activity_date').notNull(),
  activityDescription: text('activity_description'),
  activityStatus:      projectActivityStatusEnum('activity_status').notNull().default('planned'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const projectActivityRelations = relations(projectActivity, ({ one }) => ({
  project: one(project, { fields: [projectActivity.projectId], references: [project.id] }),
}))
```

---

### 6.6 MRV Models

**`src/v2/mrv/models/mrv-ingestion.model.ts`**

```typescript
import { pgTable, pgEnum, uuid, varchar, timestamp, integer } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { project } from '../../projects/models/project.model'
import { farmPlot } from '../../farmers/models/farm-plot.model'
import { farmer } from '../../farmers/models/farmer.model'
import { partner } from '../../partners/models/partner.model'

export const mrvIngestionStatusEnum = pgEnum('mrv_ingestion_status_enum', ['pending', 'processing', 'verified', 'flagged', 'failed'])

/**
 * mrv_ingestion_event
 * Crevy's tracking record for every dMRV batch submitted to CraftedClimate.
 * cc_ingestion_id: CraftedClimate's msg-ingest-uuid-XXXXX — used to correlate
 * webhook callbacks back to this record.
 * This table is the translation layer: CraftedClimate knows its device_id and CC project ID;
 * Crevy knows its plot_id and project UUID. This table maps between them.
 */
export const mrvIngestionEvent = pgTable('mrv_ingestion_event', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  ccIngestionId:        varchar('cc_ingestion_id', { length: 100 }).notNull().unique(),
  projectId:            uuid('project_id').notNull().references(() => project.id,   { onDelete: 'cascade' }),
  plotId:               uuid('plot_id').notNull().references(() => farmPlot.id,  { onDelete: 'cascade' }),
  farmerId:             uuid('farmer_id').notNull().references(() => farmer.id,   { onDelete: 'cascade' }),
  partnerId:            integer('partner_id').notNull().references(() => partner.id, { onDelete: 'restrict' }),
  deviceId:             varchar('device_id', { length: 100 }),
  submissionTimestamp:  timestamp('submission_timestamp', { withTimezone: true }),
  ingestionStatus:      mrvIngestionStatusEnum('ingestion_status').notNull().default('pending'),
  createdAt:            timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const mrvIngestionEventRelations = relations(mrvIngestionEvent, ({ one }) => ({
  project:  one(project,  { fields: [mrvIngestionEvent.projectId],  references: [project.id] }),
  farmPlot: one(farmPlot, { fields: [mrvIngestionEvent.plotId],     references: [farmPlot.id] }),
  farmer:   one(farmer,   { fields: [mrvIngestionEvent.farmerId],   references: [farmer.id] }),
  partner:  one(partner,  { fields: [mrvIngestionEvent.partnerId],  references: [partner.id] }),
}))
```

**`src/v2/mrv/models/mrv-verification.model.ts`**

```typescript
import { pgTable, pgEnum, uuid, varchar, decimal, boolean, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { mrvIngestionEvent } from './mrv-ingestion.model'
import { project } from '../../projects/models/project.model'

export const verificationStatusEnum = pgEnum('verification_status_enum', ['success', 'flagged', 'failed'])
export const geoFenceStatusEnum     = pgEnum('geo_fence_status_enum',    ['valid', 'invalid'])

/**
 * mrv_verification_result
 * Stores CraftedClimate Worker 2 webhook payload.
 * This is the DEFINITIVE scientific verdict that authorises credit issuance.
 *
 * CONSERVATISM PRINCIPLE: Always use net_credits_issued for issuance.
 * NEVER use gross_removals_tco2e — it has not had leakage or buffer deducted.
 * gross_removals_tco2e is stored for display/audit purposes only.
 *
 * If verification_status = 'flagged': carbon_accounting fields will be null.
 * No credits can be issued for a flagged batch.
 */
export const mrvVerificationResult = pgTable('mrv_verification_result', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  ingestionId:          uuid('ingestion_id').notNull().references(() => mrvIngestionEvent.id, { onDelete: 'cascade' }),
  projectId:            uuid('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
  verificationEventId:  varchar('verification_event_id', { length: 200 }).notNull().unique(),
  methodologyApplied:   varchar('methodology_applied', { length: 100 }),
  verificationStatus:   verificationStatusEnum('verification_status').notNull(),
  // AI model fields from Worker 2
  aiModelId:            varchar('ai_model_id', { length: 100 }),
  aiConfidenceScore:    decimal('ai_confidence_score', { precision: 5, scale: 4 }),
  isAnomalous:          boolean('is_anomalous').notNull().default(false),
  predictionClass:      varchar('prediction_class', { length: 100 }),
  // Spatial and hardware integrity
  geoFenceStatus:       geoFenceStatusEnum('geo_fence_status').notNull(),
  hardwareIntegrity:    varchar('hardware_integrity', { length: 50 }).notNull(),
  // Carbon accounting (null when flagged)
  grossRemovalsTco2e:   decimal('gross_removals_tco2e', { precision: 12, scale: 6 }),
  leakageDeduction:     decimal('leakage_deduction',    { precision: 12, scale: 6 }),
  bufferContribution:   decimal('buffer_contribution',  { precision: 12, scale: 6 }),
  netCreditsIssued:     decimal('net_credits_issued',   { precision: 12, scale: 6 }),  // ← USE THIS
  receivedAt:           timestamp('received_at', { withTimezone: true }),
})

export const mrvVerificationResultRelations = relations(mrvVerificationResult, ({ one }) => ({
  ingestionEvent: one(mrvIngestionEvent, { fields: [mrvVerificationResult.ingestionId], references: [mrvIngestionEvent.id] }),
  project:        one(project,           { fields: [mrvVerificationResult.projectId],   references: [project.id] }),
}))
```

**`src/v2/mrv/models/mrv-blockchain.model.ts`**

```typescript
import { pgTable, uuid, varchar, bigint, smallint, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { mrvVerificationResult } from './mrv-verification.model'
import { project } from '../../projects/models/project.model'

/**
 * mrv_blockchain_anchor
 * Stores CraftedClimate Worker 3 webhook payload.
 * transaction_hash: immutable Polygon proof. Share with auditors.
 * audit_uri: IPFS CID — permanent public audit record.
 * batch_id: groups all carbon_credit rows issued from this anchor.
 *
 * These two fields are what a corporate auditor needs to independently verify
 * a credit WITHOUT trusting Crevy: transaction_hash + audit_uri.
 */
export const mrvBlockchainAnchor = pgTable('mrv_blockchain_anchor', {
  id:              uuid('id').primaryKey().defaultRandom(),
  resultId:        uuid('result_id').notNull().unique().references(() => mrvVerificationResult.id, { onDelete: 'cascade' }),
  projectId:       uuid('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
  network:         varchar('network', { length: 100 }).notNull(),
  contractAddress: varchar('contract_address', { length: 100 }).notNull(),
  transactionHash: varchar('transaction_hash', { length: 255 }).notNull().unique(),
  blockHeight:     bigint('block_height', { mode: 'number' }),
  batchId:         varchar('batch_id', { length: 100 }).notNull().unique(),
  vintage:         smallint('vintage').notNull(),
  merkleRoot:      varchar('merkle_root', { length: 255 }).notNull(),
  auditUri:        varchar('audit_uri', { length: 500 }).notNull(),
  anchoredAt:      timestamp('anchored_at', { withTimezone: true }),
})

export const mrvBlockchainAnchorRelations = relations(mrvBlockchainAnchor, ({ one }) => ({
  verificationResult: one(mrvVerificationResult, { fields: [mrvBlockchainAnchor.resultId],   references: [mrvVerificationResult.id] }),
  project:            one(project,               { fields: [mrvBlockchainAnchor.projectId],  references: [project.id] }),
}))
```

---

### 6.7 Credits Models

**`src/v2/credits/models/carbon-credit.model.ts`**

```typescript
import { pgTable, pgEnum, uuid, varchar, decimal, smallint, date, text, timestamp, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { project } from '../../projects/models/project.model'
import { mrvBlockchainAnchor } from '../../mrv/models/mrv-blockchain.model'

export const creditStatusEnum = pgEnum('credit_status_enum', ['available', 'reserved', 'sold', 'retired', 'invalidated'])

/**
 * carbon_credit
 * One row = one tCO₂e. Individually serialised so the full chain of custody
 * from issuance to retirement is traceable.
 *
 * HOW CREDITS ARE ISSUED:
 * 1. CraftedClimate Worker 3 webhook fires with verification_status=SUCCESS.
 * 2. MrvService.handleBlockchainWebhook() reads net_credits_issued from the
 *    linked mrv_verification_result.
 * 3. CreditService.issueCredits() creates net_credits_issued number of rows here.
 * 4. Each row gets: mrv_batch_id, blockchain_tx_hash, credit_serial_number, vintage.
 * 5. current_owner_id is set to the project's primary farmer's user_id.
 *
 * DATE SEQUENCE (chronological order):
 *   generation_date   → end of sensor measurement period (carbon physically removed)
 *   verification_date → CraftedClimate Worker 2 SUCCESS timestamp
 *   issuance_date     → when this credit row was created on Crevy (credits cannot be sold before this)
 */
export const carbonCredit = pgTable('carbon_credit', {
  id:                  uuid('id').primaryKey().defaultRandom(),
  projectId:           uuid('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
  creditSerialNumber:  varchar('credit_serial_number', { length: 100 }).notNull().unique(),
  creditAmount:        decimal('credit_amount', { precision: 12, scale: 6 }).notNull().default('1.0'),
  creditVintage:       smallint('credit_vintage').notNull(),
  creditStatus:        creditStatusEnum('credit_status').notNull().default('available'),
  mrv_batch_id:        varchar('mrv_batch_id', { length: 100 }).notNull()
                         .references(() => mrvBlockchainAnchor.batchId, { onDelete: 'restrict' }),
  blockchainTxHash:    varchar('blockchain_tx_hash', { length: 255 }).notNull(),
  currentOwnerId:      text('current_owner_id').notNull(), // FK → user.id
  registry:            varchar('registry', { length: 100 }),
  generationDate:      date('generation_date'),
  verificationDate:    date('verification_date'),
  issuanceDate:        date('issuance_date'),
  transactionId:       uuid('transaction_id'),  // FK → credit_transaction.id (added via ALTER in SQL)
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_carbon_credit_project').on(t.projectId),
  index('idx_carbon_credit_status').on(t.creditStatus),
  index('idx_carbon_credit_owner').on(t.currentOwnerId),
  index('idx_carbon_credit_vintage').on(t.creditVintage),
  index('idx_carbon_credit_batch').on(t.mrv_batch_id),
])
```

**`src/v2/credits/models/credit-transaction.model.ts`**

```typescript
import { pgTable, pgEnum, uuid, varchar, decimal, boolean, integer, text, timestamp, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { currency } from '../../auth/models/currency.model'

export const transactionStatusEnum = pgEnum('transaction_status_enum', ['pending', 'completed', 'failed', 'refunded'])

/**
 * credit_transaction
 * Crevy's immutable sales ledger. One transaction covers a batch of credits.
 * total_amount is stored (denormalised) at transaction time — never recomputed.
 * is_internal_sale = FALSE: real sale → triggers farmer payout + platform fee.
 * is_internal_sale = TRUE:  administrative transfer (buffer pool, retirement) → no money movement.
 */
export const creditTransaction = pgTable('credit_transaction', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  transactionRef:     varchar('transaction_ref', { length: 100 }).notNull().unique(),
  buyerId:            text('buyer_id').notNull(),   // FK → user.id
  sellerId:           text('seller_id').notNull(),  // FK → user.id
  isInternalSale:     boolean('is_internal_sale').notNull().default(false),
  quantity:           decimal('quantity',          { precision: 12, scale: 2 }).notNull(),
  pricePerCredit:     decimal('price_per_credit',  { precision: 10, scale: 2 }).notNull(),
  totalAmount:        decimal('total_amount',      { precision: 15, scale: 2 }).notNull(),
  currencyId:         integer('currency_id').notNull().references(() => currency.id, { onDelete: 'restrict' }),
  transactionStatus:  transactionStatusEnum('transaction_status').notNull().default('pending'),
  transactionDate:    timestamp('transaction_date', { withTimezone: true }).notNull().defaultNow(),
  notes:              text('notes'),
  createdAt:          timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_credit_txn_buyer').on(t.buyerId),
  index('idx_credit_txn_seller').on(t.sellerId),
  index('idx_credit_txn_status').on(t.transactionStatus),
])

export const creditTransactionRelations = relations(creditTransaction, ({ one }) => ({
  currency: one(currency, { fields: [creditTransaction.currencyId], references: [currency.id] }),
}))
```

**`src/v2/credits/models/verification.model.ts`**

```typescript
import { pgTable, uuid, integer, varchar, date, text, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { project } from '../../projects/models/project.model'
import { partner } from '../../partners/models/partner.model'
import { verificationStatusEnum } from '../../mrv/models/mrv-verification.model'

/**
 * verification
 * Crevy's business-layer record of each formal verification outcome.
 * References CraftedClimate as the verifying partner (verifier_partner_id).
 * verification_event_id is CraftedClimate's v-verify-uuid-XXXXX — correlates back
 * to mrv_verification_result and CraftedClimate's own audit logs.
 * A project accumulates multiple verifications over its lifetime (one per dMRV cycle).
 */
export const verification = pgTable('verification', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  projectId:            uuid('project_id').notNull().references(() => project.id,  { onDelete: 'cascade' }),
  verifierPartnerId:    integer('verifier_partner_id').notNull().references(() => partner.id, { onDelete: 'restrict' }),
  verificationEventId:  varchar('verification_event_id', { length: 200 }).notNull().unique(),
  methodologyApplied:   varchar('methodology_applied', { length: 100 }),
  verificationDate:     date('verification_date').notNull(),
  verificationStatus:   verificationStatusEnum('verification_status').notNull(),
  verificationNotes:    text('verification_notes'),
  createdAt:            timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const verificationRelations = relations(verification, ({ one }) => ({
  project: one(project, { fields: [verification.projectId],         references: [project.id] }),
  partner: one(partner, { fields: [verification.verifierPartnerId], references: [partner.id] }),
}))
```

---

### 6.8 Financial Models

**`src/v2/financials/models/payout.model.ts`**

```typescript
import { pgTable, pgEnum, uuid, varchar, decimal, date, integer, text, timestamp, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { farmer } from '../../farmers/models/farmer.model'
import { project } from '../../projects/models/project.model'
import { creditTransaction } from '../../credits/models/credit-transaction.model'
import { currency } from '../../auth/models/currency.model'

export const payoutMethodEnum = pgEnum('payout_method_enum', ['mobile_money', 'bank_transfer', 'cash'])
export const payoutStatusEnum = pgEnum('payout_status_enum', ['pending', 'completed', 'failed'])

/**
 * payout
 * Payment disbursements to farmers following a credit sale.
 * Triggered when credit_transaction.status transitions to 'completed' for a non-internal sale.
 * payment_ref format: PAY-2026-000001 — generated by the application layer.
 */
export const payout = pgTable('payout', {
  id:            uuid('id').primaryKey().defaultRandom(),
  paymentRef:    varchar('payment_ref', { length: 100 }).notNull().unique(),
  farmerId:      uuid('farmer_id').notNull().references(() => farmer.id,            { onDelete: 'restrict' }),
  projectId:     uuid('project_id').notNull().references(() => project.id,          { onDelete: 'restrict' }),
  transactionId: uuid('transaction_id').notNull().references(() => creditTransaction.id, { onDelete: 'restrict' }),
  payoutAmount:  decimal('payout_amount', { precision: 12, scale: 2 }).notNull(),
  currencyId:    integer('currency_id').notNull().references(() => currency.id,     { onDelete: 'restrict' }),
  payoutDate:    date('payout_date').notNull(),
  payoutMethod:  payoutMethodEnum('payout_method').notNull(),
  payoutStatus:  payoutStatusEnum('payout_status').notNull().default('pending'),
  notes:         text('notes'),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:     timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index('idx_payout_farmer').on(t.farmerId),
  index('idx_payout_project').on(t.projectId),
  index('idx_payout_status').on(t.payoutStatus),
])

export const payoutRelations = relations(payout, ({ one }) => ({
  farmer:      one(farmer,            { fields: [payout.farmerId],      references: [farmer.id] }),
  project:     one(project,           { fields: [payout.projectId],     references: [project.id] }),
  transaction: one(creditTransaction, { fields: [payout.transactionId], references: [creditTransaction.id] }),
  currency:    one(currency,          { fields: [payout.currencyId],    references: [currency.id] }),
}))
```

**`src/v2/financials/models/financial-record.model.ts`** and **`contract.model.ts`** follow the same pattern using the `record_type_enum`, `contract_type_enum`, and `contract_status_enum` from the SQL — apply the same Drizzle conventions shown above.

---

## 7. Module 1: RBAC (Roles & Permissions)

### What this module does

The RBAC module lets admins define what each role can do on the platform. It is the foundation of access control. On first migration, seed the standard roles and permissions (see Section 19).

### Zod Schemas (`src/v2/rbac/schema/rbac.schema.ts`)

```typescript
import { z } from 'zod'

export const createRoleSchema = z.object({
  body: z.object({
    name:        z.string().min(2).max(50),
    description: z.string().max(255).optional(),
  })
})

export const createPermissionSchema = z.object({
  body: z.object({
    resource:    z.string().min(2).max(100),
    action:      z.string().min(2).max(100),
    description: z.string().max(255).optional(),
  })
})

export const assignPermissionToRoleSchema = z.object({
  params: z.object({ roleId: z.string().regex(/^\d+$/) }),
  body:   z.object({ permissionId: z.number().int().positive() })
})

export const assignRoleToUserSchema = z.object({
  body: z.object({
    userId: z.string().uuid(),
    roleId: z.number().int().positive(),
  })
})
```

### TDD Tests (`src/v2/rbac/tests/rbac.test.ts`)

Write your tests BEFORE writing the service and controller. This is TDD.

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import app from '../../../index'  // the Express app

describe('RBAC Module', () => {

  describe('POST /api/v2/rbac/roles', () => {
    it('should create a new role when given valid data', async () => {
      const res = await request(app)
        .post('/api/v2/rbac/roles')
        .set('Authorization', 'Bearer <admin_token>')
        .send({ name: 'field_agent', description: 'Manages farmers in the field' })
      expect(res.status).toBe(201)
      expect(res.body.data).toHaveProperty('id')
      expect(res.body.data.name).toBe('field_agent')
    })

    it('should return 409 if the role name already exists', async () => {
      // First create
      await request(app).post('/api/v2/rbac/roles')
        .set('Authorization', 'Bearer <admin_token>')
        .send({ name: 'duplicate_role' })
      // Second create — should fail
      const res = await request(app).post('/api/v2/rbac/roles')
        .set('Authorization', 'Bearer <admin_token>')
        .send({ name: 'duplicate_role' })
      expect(res.status).toBe(409)
    })

    it('should return 400 if name is missing', async () => {
      const res = await request(app).post('/api/v2/rbac/roles')
        .set('Authorization', 'Bearer <admin_token>')
        .send({})
      expect(res.status).toBe(400)
    })

    it('should return 401 if not authenticated', async () => {
      const res = await request(app).post('/api/v2/rbac/roles').send({ name: 'test' })
      expect(res.status).toBe(401)
    })
  })

  describe('POST /api/v2/rbac/permissions', () => {
    it('should create a permission', async () => {
      const res = await request(app)
        .post('/api/v2/rbac/permissions')
        .set('Authorization', 'Bearer <admin_token>')
        .send({ resource: 'projects', action: 'approve' })
      expect(res.status).toBe(201)
    })

    it('should return 409 on duplicate resource+action', async () => {
      await request(app).post('/api/v2/rbac/permissions')
        .set('Authorization', 'Bearer <admin_token>')
        .send({ resource: 'projects', action: 'approve' })
      const res = await request(app).post('/api/v2/rbac/permissions')
        .set('Authorization', 'Bearer <admin_token>')
        .send({ resource: 'projects', action: 'approve' })
      expect(res.status).toBe(409)
    })
  })

  describe('POST /api/v2/rbac/roles/:roleId/permissions', () => {
    it('should assign a permission to a role', async () => {
      // Create role and permission first, then assign
      const res = await request(app)
        .post('/api/v2/rbac/roles/1/permissions')
        .set('Authorization', 'Bearer <admin_token>')
        .send({ permissionId: 1 })
      expect(res.status).toBe(200)
    })
  })

  describe('GET /api/v2/rbac/roles', () => {
    it('should return all roles', async () => {
      const res = await request(app)
        .get('/api/v2/rbac/roles')
        .set('Authorization', 'Bearer <admin_token>')
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.data)).toBe(true)
    })
  })
})
```

### Service Layer (`src/v2/rbac/services/rbac.service.ts`)

```typescript
import { db } from '@config/db'
import { eq, and } from 'drizzle-orm'
import { role, permission, rolePermission, userRole } from '../models/rbac.model'
import AppError from '@shared/errors/AppError'

const RbacService = {
  createRole: async (data: { name: string; description?: string }) => {
    const existing = await db.query.role.findFirst({ where: eq(role.name, data.name) })
    if (existing) throw new AppError('Role with this name already exists', 409)
    const [newRole] = await db.insert(role).values(data).returning()
    return newRole
  },

  getRoles: async () => {
    return db.select().from(role)
  },

  createPermission: async (data: { resource: string; action: string; description?: string }) => {
    const existing = await db.query.permission.findFirst({
      where: and(eq(permission.resource, data.resource), eq(permission.action, data.action))
    })
    if (existing) throw new AppError('Permission already exists', 409)
    const [newPermission] = await db.insert(permission).values(data).returning()
    return newPermission
  },

  getPermissions: async () => {
    return db.select().from(permission)
  },

  assignPermissionToRole: async (roleId: number, permissionId: number, grantedBy: string) => {
    const existing = await db.query.rolePermission.findFirst({
      where: and(eq(rolePermission.roleId, roleId), eq(rolePermission.permissionId, permissionId))
    })
    if (existing) throw new AppError('Permission already assigned to this role', 409)
    const [result] = await db.insert(rolePermission).values({ roleId, permissionId, grantedBy }).returning()
    return result
  },

  getRolePermissions: async (roleId: number) => {
    return db.select({ permission }).from(rolePermission)
      .innerJoin(permission, eq(rolePermission.permissionId, permission.id))
      .where(eq(rolePermission.roleId, roleId))
  },

  assignRoleToUser: async (userId: string, roleId: number, assignedBy: string) => {
    const [result] = await db.insert(userRole).values({ userId, roleId, assignedBy }).returning()
    return result
  },

  getUserRoles: async (userId: string) => {
    return db.select({ role }).from(userRole)
      .innerJoin(role, eq(userRole.roleId, role.id))
      .where(eq(userRole.userId, userId))
  },

  /**
   * Permission check: does this user have permission to perform `action` on `resource`?
   * Called by the requirePermission middleware.
   */
  hasPermission: async (userId: string, resource: string, action: string): Promise<boolean> => {
    const result = await db
      .select({ permissionId: rolePermission.permissionId })
      .from(userRole)
      .innerJoin(rolePermission, eq(userRole.roleId, rolePermission.roleId))
      .innerJoin(permission, and(
        eq(rolePermission.permissionId, permission.id),
        eq(permission.resource, resource),
        eq(permission.action, action),
      ))
      .where(and(eq(userRole.userId, userId), eq(userRole.isActive, true)))
      .limit(1)
    return result.length > 0
  },
}

export default RbacService
```

### Controller (`src/v2/rbac/controllers/rbac.controller.ts`)

```typescript
import { Request, Response, NextFunction } from 'express'
import { catchAsync } from '@shared/errors/errorHandler'
import RbacService from '../services/rbac.service'

const RbacController = {
  createRole: catchAsync(async (req: Request, res: Response) => {
    const data = await RbacService.createRole(req.body)
    res.status(201).json({ success: true, message: 'Role created', data })
  }),

  getRoles: catchAsync(async (req: Request, res: Response) => {
    const data = await RbacService.getRoles()
    res.status(200).json({ success: true, message: 'Roles retrieved', data })
  }),

  createPermission: catchAsync(async (req: Request, res: Response) => {
    const data = await RbacService.createPermission(req.body)
    res.status(201).json({ success: true, message: 'Permission created', data })
  }),

  getPermissions: catchAsync(async (req: Request, res: Response) => {
    const data = await RbacService.getPermissions()
    res.status(200).json({ success: true, message: 'Permissions retrieved', data })
  }),

  assignPermissionToRole: catchAsync(async (req: Request, res: Response) => {
    const roleId = parseInt(req.params.roleId)
    const { permissionId } = req.body
    const data = await RbacService.assignPermissionToRole(roleId, permissionId, req.user!.id)
    res.status(200).json({ success: true, message: 'Permission assigned', data })
  }),

  assignRoleToUser: catchAsync(async (req: Request, res: Response) => {
    const { userId, roleId } = req.body
    const data = await RbacService.assignRoleToUser(userId, roleId, req.user!.id)
    res.status(200).json({ success: true, message: 'Role assigned', data })
  }),

  getUserRoles: catchAsync(async (req: Request, res: Response) => {
    const data = await RbacService.getUserRoles(req.params.userId)
    res.status(200).json({ success: true, message: 'User roles retrieved', data })
  }),
}

export default RbacController
```

### Routes (`src/v2/rbac/routes/rbac.route.ts`)

```typescript
import { Router } from 'express'
import { requireAuth } from '@/middleware/auth.middleware'
import validateInboundRequest from '@/middleware/validateInboundRequest.middleware'
import RbacController from '../controllers/rbac.controller'
import { createRoleSchema, createPermissionSchema, assignPermissionToRoleSchema, assignRoleToUserSchema } from '../schema/rbac.schema'

export const rbacRouter = Router()

// All RBAC routes require authentication
// In production, add a requirePermission('rbac', 'manage') guard

rbacRouter.post('/roles',           requireAuth, validateInboundRequest(createRoleSchema),      RbacController.createRole)
rbacRouter.get('/roles',            requireAuth,                                                 RbacController.getRoles)
rbacRouter.post('/permissions',     requireAuth, validateInboundRequest(createPermissionSchema), RbacController.createPermission)
rbacRouter.get('/permissions',      requireAuth,                                                 RbacController.getPermissions)
rbacRouter.post('/roles/:roleId/permissions', requireAuth, validateInboundRequest(assignPermissionToRoleSchema), RbacController.assignPermissionToRole)
rbacRouter.post('/users/assign-role',         requireAuth, validateInboundRequest(assignRoleToUserSchema),        RbacController.assignRoleToUser)
rbacRouter.get('/users/:userId/roles',        requireAuth,                                                         RbacController.getUserRoles)
```

---

## 8. Module 2: Auth & Users

### What this module does

User registration, login, logout, profile management, and currency management. better-auth handles the session mechanics; this module handles Crevy-specific user lifecycle.

### Zod Schemas (`src/v2/auth/schema/auth.schema.ts`)

```typescript
import { z } from 'zod'

export const registerUserSchema = z.object({
  body: z.object({
    email:              z.string().email(),
    password:           z.string().min(8),
    firstName:          z.string().min(1).max(100),
    lastName:           z.string().min(1).max(100),
    contactNumber:      z.string().max(20).optional(),
    countryOfOperation: z.string().max(100).optional(),
    defaultCurrencyId:  z.number().int().positive().optional(),
    // Role to assign on registration
    roleId:             z.number().int().positive().optional(),
  })
})

export const updateProfileSchema = z.object({
  body: z.object({
    firstName:          z.string().min(1).max(100).optional(),
    lastName:           z.string().min(1).max(100).optional(),
    contactNumber:      z.string().max(20).optional(),
    countryOfOperation: z.string().max(100).optional(),
    defaultCurrencyId:  z.number().int().positive().optional(),
  })
})

export const createCurrencySchema = z.object({
  body: z.object({
    code: z.string().length(3).toUpperCase(),
    name: z.string().min(2).max(50),
  })
})
```

### TDD Tests (`src/v2/auth/tests/auth.test.ts`)

```typescript
describe('Auth Module', () => {

  describe('POST /api/v2/auth/register', () => {
    it('should register a new user and return 201', async () => {
      const res = await request(app)
        .post('/api/v2/auth/register')
        .send({
          email: 'test@crevy.io',
          password: 'Password123!',
          firstName: 'Kofi',
          lastName: 'Boateng',
        })
      expect(res.status).toBe(201)
      expect(res.body.data).toHaveProperty('id')
      expect(res.body.data.email).toBe('test@crevy.io')
    })

    it('should return 409 if email already exists', async () => {
      await request(app).post('/api/v2/auth/register').send({ email: 'dup@crevy.io', password: 'Pass123!', firstName: 'A', lastName: 'B' })
      const res = await request(app).post('/api/v2/auth/register').send({ email: 'dup@crevy.io', password: 'Pass123!', firstName: 'C', lastName: 'D' })
      expect(res.status).toBe(409)
    })

    it('should return 400 for invalid email', async () => {
      const res = await request(app).post('/api/v2/auth/register').send({ email: 'notanemail', password: 'Pass123!', firstName: 'A', lastName: 'B' })
      expect(res.status).toBe(400)
    })

    it('should return 400 for password under 8 characters', async () => {
      const res = await request(app).post('/api/v2/auth/register').send({ email: 'ok@crevy.io', password: '123', firstName: 'A', lastName: 'B' })
      expect(res.status).toBe(400)
    })
  })

  describe('GET /api/v2/auth/me', () => {
    it('should return the authenticated user profile', async () => {
      const res = await request(app)
        .get('/api/v2/auth/me')
        .set('Authorization', 'Bearer <valid_token>')
      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('email')
    })

    it('should return 401 without a token', async () => {
      const res = await request(app).get('/api/v2/auth/me')
      expect(res.status).toBe(401)
    })
  })

  describe('PUT /api/v2/auth/me', () => {
    it('should update user profile', async () => {
      const res = await request(app)
        .put('/api/v2/auth/me')
        .set('Authorization', 'Bearer <valid_token>')
        .send({ firstName: 'Abena', contactNumber: '+233200000000' })
      expect(res.status).toBe(200)
      expect(res.body.data.firstName).toBe('Abena')
    })
  })

  describe('GET /api/v2/auth/currencies', () => {
    it('should return list of currencies', async () => {
      const res = await request(app).get('/api/v2/auth/currencies')
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.data)).toBe(true)
    })
  })
})
```

### Service (`src/v2/auth/services/auth.service.ts`)

```typescript
import { db } from '@config/db'
import { eq } from 'drizzle-orm'
import { auth } from '@shared/utils/auth'
import { user } from '../models/user.model'
import { currency } from '../models/currency.model'
import { userRole } from '../../rbac/models/rbac.model'
import AppError from '@shared/errors/AppError'

const AuthService = {
  registerUser: async (data: {
    email: string; password: string; firstName: string; lastName: string;
    contactNumber?: string; countryOfOperation?: string; defaultCurrencyId?: number; roleId?: number;
  }) => {
    const existing = await db.query.user.findFirst({ where: eq(user.email, data.email) })
    if (existing) throw new AppError('User with this email already exists', 409)

    // 1. Create user via better-auth (handles password hashing + session/account records)
    const betterUser = await auth.api.signUpEmail({
      body: {
        email: data.email,
        password: data.password,
        name: `${data.firstName} ${data.lastName}`,
        firstName: data.firstName,
        lastName: data.lastName,
        contactNumber: data.contactNumber ?? null,
        countryOfOperation: data.countryOfOperation ?? null,
        defaultCurrencyId: data.defaultCurrencyId ?? null,
        profileCompleted: true,
      }
    })
    if (!betterUser) throw new AppError('Failed to create user', 500)

    // 2. Assign default role if provided
    if (data.roleId) {
      await db.insert(userRole).values({ userId: betterUser.user.id, roleId: data.roleId })
    }

    return betterUser.user
  },

  getMe: async (userId: string) => {
    const result = await db.query.user.findFirst({
      where: eq(user.id, userId),
      with: { currency: true },
    })
    if (!result) throw new AppError('User not found', 404)
    return result
  },

  updateProfile: async (userId: string, data: Partial<typeof user.$inferInsert>) => {
    const [updated] = await db.update(user).set({ ...data, updatedAt: new Date() })
      .where(eq(user.id, userId)).returning()
    if (!updated) throw new AppError('User not found', 404)
    return updated
  },

  getCurrencies: async () => {
    return db.select().from(currency)
  },

  createCurrency: async (data: { code: string; name: string }) => {
    const existing = await db.query.currency.findFirst({ where: eq(currency.code, data.code) })
    if (existing) throw new AppError('Currency already exists', 409)
    const [result] = await db.insert(currency).values(data).returning()
    return result
  },
}

export default AuthService
```

### Routes (`src/v2/auth/routes/auth.route.ts`)

```typescript
import { Router } from 'express'
import { requireAuth } from '@/middleware/auth.middleware'
import validateInboundRequest from '@/middleware/validateInboundRequest.middleware'
import AuthController from '../controllers/auth.controller'
import { registerUserSchema, updateProfileSchema, createCurrencySchema } from '../schema/auth.schema'

export const authRouter = Router()

// Public
authRouter.post('/register', validateInboundRequest(registerUserSchema), AuthController.register)
authRouter.get('/currencies', AuthController.getCurrencies)

// better-auth handles /login, /logout, /session — mounted at /api/auth in index.ts

// Protected
authRouter.get('/me',     requireAuth, AuthController.getMe)
authRouter.put('/me',     requireAuth, validateInboundRequest(updateProfileSchema), AuthController.updateProfile)
authRouter.post('/currencies', requireAuth, validateInboundRequest(createCurrencySchema), AuthController.createCurrency)
```

---

## 9. Module 3: Partners

Partners are external organisations — CraftedClimate, auditing bodies, and channel partners.

### Key business rules (enforce in service layer)

1. Only admins can create, update, or approve partners.
2. A partner must be `approved` before it can be linked to an `mrv_ingestion_event`.
3. CraftedClimate is seeded with `code: 'CC'` and `partner_type: 'dMRV_provider'` on first migration.

### TDD Tests (`src/v2/partners/tests/partner.test.ts`)

```typescript
describe('Partners Module', () => {
  describe('POST /api/v2/partners', () => {
    it('should create a partner (admin only)', async () => {
      const res = await request(app)
        .post('/api/v2/partners')
        .set('Authorization', 'Bearer <admin_token>')
        .send({
          name: 'CraftedClimate',
          code: 'CC',
          partnerType: 'dMRV_provider',
          contactPerson: 'Test Contact',
          contactEmail: 'contact@craftedclimate.com',
          country: 'Kenya',
        })
      expect(res.status).toBe(201)
      expect(res.body.data.code).toBe('CC')
    })

    it('should return 403 if user is not admin', async () => {
      const res = await request(app)
        .post('/api/v2/partners')
        .set('Authorization', 'Bearer <farmer_token>')
        .send({ name: 'SomePartner', partnerType: 'channel', contactPerson: 'x', contactEmail: 'x@x.com' })
      expect(res.status).toBe(403)
    })
  })

  describe('PATCH /api/v2/partners/:id/status', () => {
    it('should approve a partner', async () => {
      const res = await request(app)
        .patch('/api/v2/partners/1/status')
        .set('Authorization', 'Bearer <admin_token>')
        .send({ status: 'approved' })
      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('approved')
    })

    it('should reject invalid status transitions', async () => {
      // Cannot approve an already-suspended partner via this route
    })
  })

  describe('GET /api/v2/partners', () => {
    it('should return a paginated list of partners', async () => {
      const res = await request(app)
        .get('/api/v2/partners')
        .set('Authorization', 'Bearer <admin_token>')
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.data.partners)).toBe(true)
      expect(res.body.data).toHaveProperty('total')
    })
  })
})
```

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v2/partners` | Admin | Create a partner |
| `GET` | `/api/v2/partners` | Admin | List all partners (paginated) |
| `GET` | `/api/v2/partners/:id` | Admin | Get partner by ID |
| `PUT` | `/api/v2/partners/:id` | Admin | Update partner details |
| `PATCH` | `/api/v2/partners/:id/status` | Admin | Approve / suspend a partner |

---

## 10. Module 4: Farmer Management

### What this module covers

Farmer profiles, farm plot registration (including GPS boundary capture), and agent assignments.

### Key business rules

1. A farmer profile is created by an admin or agent after a user registers with role `farmer`.
2. A `farm_plot` with `boundary_collection_method = 'buffered_centroid'` cannot be submitted for dMRV. The service must enforce this.
3. Only one `PRIMARY` farmer assignment is allowed per farmer at a time.
4. The farmer `code` is auto-generated: `FRM-{COUNTRY_CODE}-{ZERO_PADDED_SEQUENCE}`. The service generates this.
5. `boundary_verified` must be set to `TRUE` by an admin before dMRV submission.

### Key Farmer Service Functions

```typescript
// src/v2/farmers/services/farmer.service.ts

const FarmerService = {
  createFarmer: async (userId: string, data, createdBy: string) => {
    // 1. Check user exists
    // 2. Check no farmer profile already exists for this user
    // 3. Generate farmer code: FRM-GH-000001
    // 4. Insert farmer record
  },

  registerPlot: async (farmerId: string, plotData) => {
    // 1. Verify farmer exists
    // 2. If only centroid provided (no boundary):
    //    - Call DB function generate_buffered_boundary() to create circle polygon
    //    - Set boundary_collection_method = 'buffered_centroid'
    //    - Set boundary_verified = false
    // 3. Insert farm_plot record
    // IMPORTANT: Do NOT allow dMRV submission for 'buffered_centroid' plots
  },

  updatePlotBoundary: async (plotId: string, boundaryWKT: string, method: string, verifiedBy: string) => {
    // 1. Update boundary geometry
    // 2. Set boundary_collection_method to the provided method
    // 3. If verifiedBy is an admin, set boundary_verified = true
  },

  assignAgent: async (farmerId: string, agentId: string, assignedBy: string, data) => {
    // 1. If assignment_type = 'primary', check no other active primary assignment exists
    //    If one exists, deactivate it first (isActive = false)
    // 2. Insert new farmer_assignment record
  },
}
```

### TDD Tests (abbreviated)

```typescript
describe('Farmer Module', () => {
  describe('POST /api/v2/farmers', () => {
    it('should create a farmer profile for an existing user', ...)
    it('should return 409 if farmer profile already exists for user', ...)
    it('should auto-generate a unique farmer code', ...)
  })

  describe('POST /api/v2/farmers/:farmerId/plots', () => {
    it('should register a plot with centroid only (buffered_centroid method)', ...)
    it('should register a plot with full GPS boundary polygon', ...)
    it('should return 400 if area_hectares is 0 or negative', ...)
  })

  describe('PATCH /api/v2/farmers/plots/:plotId/boundary', () => {
    it('should update plot boundary and set boundary_verified on admin approval', ...)
    it('should reject non-admin boundary verification', ...)
  })

  describe('POST /api/v2/farmers/:farmerId/assignments', () => {
    it('should create a primary assignment', ...)
    it('should deactivate existing primary assignment when creating a new primary', ...)
    it('should allow multiple secondary assignments', ...)
  })
})
```

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v2/farmers` | Admin/Agent | Create farmer profile |
| `GET` | `/api/v2/farmers` | Admin | List farmers (paginated, filterable) |
| `GET` | `/api/v2/farmers/:id` | Admin/Agent | Get farmer by ID |
| `PUT` | `/api/v2/farmers/:id` | Admin/Agent | Update farmer profile |
| `PATCH` | `/api/v2/farmers/:id/verification` | Admin | Update KYC verification status |
| `POST` | `/api/v2/farmers/:id/plots` | Admin/Agent | Register a farm plot |
| `GET` | `/api/v2/farmers/:id/plots` | Admin/Agent | List plots for a farmer |
| `GET` | `/api/v2/farmers/plots/:plotId` | Admin/Agent | Get a single plot |
| `PATCH` | `/api/v2/farmers/plots/:plotId/boundary` | Admin/Agent | Update plot boundary |
| `POST` | `/api/v2/farmers/:id/assignments` | Admin | Assign an agent to a farmer |
| `GET` | `/api/v2/farmers/:id/assignments` | Admin | Get farmer's agent assignments |

---

## 11. Module 5: Project Management

### What this module covers

Project creation, farmer enrollment, plot enrollment, and activity tracking.

### Key business rules

1. A project's `code` is auto-generated: `PRJ-{COUNTRY}-{YEAR}-{SEQ}`. This maps to CraftedClimate's `CC-PROJECT-ID`.
2. A plot cannot be enrolled in two concurrent projects (`project_plot_status = 'enrolled'`). The partial unique index enforces this at DB level; the service should give a clear error message.
3. `enrolled_area_hectares` must be `> 0` and `≤ farm_plot.area_hectares`.
4. Before a project can move from `draft` → `active`, it must have at least one enrolled farmer and one enrolled plot.
5. Only `boundary_verified = TRUE` plots can be enrolled in a project (because they are eligible for dMRV).

### Key Project Service Functions

```typescript
const ProjectService = {
  createProject: async (data, createdBy: string) => {
    // 1. Generate project code: PRJ-GH-2026-001
    // 2. Validate currency exists
    // 3. Insert project with status 'draft', stage 'registration'
  },

  enrollFarmer: async (projectId: string, farmerId: string, joinedDate: Date) => {
    // 1. Check project is in a state that allows enrollment (not 'closed')
    // 2. Check farmer is not already enrolled (UNIQUE constraint)
    // 3. Insert project_farmer record
  },

  enrollPlot: async (projectId: string, plotId: string, enrolledAreaHectares: number) => {
    // 1. Check plot boundary_verified = TRUE (required for dMRV)
    // 2. Check enrolled_area_hectares <= farm_plot.area_hectares
    // 3. Check plot is not already 'enrolled' in another project
    //    (the DB partial unique index will catch this, but catch the error
    //    and return a human-readable message)
    // 4. Insert project_plot record
  },

  activateProject: async (projectId: string) => {
    // 1. Check project has >= 1 enrolled farmer
    // 2. Check project has >= 1 enrolled, verified plot
    // 3. Update project_status to 'active', project_stage to 'active'
  },

  logActivity: async (projectId: string, activityData) => {
    // Insert project_activity row
  },
}
```

### TDD Tests (abbreviated)

```typescript
describe('Project Module', () => {
  describe('POST /api/v2/projects', () => {
    it('should create a project with auto-generated code', ...)
    it('should default to status=draft, stage=registration', ...)
    it('should return 400 if currency_id does not exist', ...)
  })

  describe('POST /api/v2/projects/:id/farmers', () => {
    it('should enroll a farmer', ...)
    it('should return 409 if farmer already enrolled', ...)
  })

  describe('POST /api/v2/projects/:id/plots', () => {
    it('should enroll a verified plot', ...)
    it('should return 400 if plot boundary is not verified', ...)
    it('should return 409 if plot is already enrolled in another project', ...)
    it('should return 400 if enrolled_area_hectares > plot area', ...)
  })

  describe('PATCH /api/v2/projects/:id/activate', () => {
    it('should activate project if it has enrolled farmers and verified plots', ...)
    it('should return 400 if no farmers enrolled', ...)
  })
})
```

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v2/projects` | Auth | Create a project |
| `GET` | `/api/v2/projects` | Auth | List projects (paginated, filterable by type/status) |
| `GET` | `/api/v2/projects/marketplace` | Public | List available credits for marketplace |
| `GET` | `/api/v2/projects/:id` | Auth | Get project detail |
| `PUT` | `/api/v2/projects/:id` | Auth | Update project |
| `PATCH` | `/api/v2/projects/:id/activate` | Admin | Move draft → active |
| `POST` | `/api/v2/projects/:id/farmers` | Admin | Enroll a farmer |
| `GET` | `/api/v2/projects/:id/farmers` | Auth | List enrolled farmers |
| `POST` | `/api/v2/projects/:id/plots` | Admin | Enroll a plot |
| `GET` | `/api/v2/projects/:id/plots` | Auth | List enrolled plots |
| `POST` | `/api/v2/projects/:id/activities` | Admin | Log a project activity |
| `GET` | `/api/v2/projects/:id/activities` | Auth | Get activity timeline |

---

## 12. Module 6: MRV Pipeline

### What this module covers

The integration layer with CraftedClimate's dMRV system. This is the most critical module — it is the pipeline through which carbon credits are born.

### How the MRV pipeline works (for junior devs)

```
1. Admin registers a sensor on a farm plot (links device_id to plot_id).
2. CraftedClimate's sensor on the plot sends telemetry every 15 minutes.
3. CraftedClimate's pipeline processes the data (Worker 1 → 2 → 3).
4. CraftedClimate fires webhooks to Crevy (asynchronously, 30–120 seconds after ingestion).
5. Crevy's webhook handler receives the payloads and:
   a. On Worker 2 (VERIFICATION) webhook:
      - Writes mrv_verification_result row
      - Updates mrv_ingestion_event.status
      - If SUCCESS: triggers credit issuance
   b. On Worker 3 (BLOCKCHAIN) webhook:
      - Writes mrv_blockchain_anchor row
      - Updates the corresponding carbon_credit rows with tx_hash and audit_uri
```

### Webhook Security

Every incoming webhook from CraftedClimate must be authenticated. The spec says all API calls require a `Bearer Token scoped to the partner's project ID`. Implement this as a dedicated middleware:

```typescript
// src/v2/mrv/middleware/mrv-webhook.middleware.ts
import { Request, Response, NextFunction } from 'express'
import { createHash } from 'crypto'
import AppError from '@shared/errors/AppError'

/**
 * Validates incoming CraftedClimate webhook requests.
 * Two-layer verification:
 * 1. Bearer token matches CC_WEBHOOK_SECRET env var
 * 2. content_sha256 header matches SHA-256 of raw request body
 */
export const requireMrvWebhookAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization']
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Missing webhook authorization', 401))
  }

  const token = authHeader.split(' ')[1]
  if (token !== process.env.CC_WEBHOOK_SECRET) {
    return next(new AppError('Invalid webhook token', 401))
  }

  // Verify content SHA-256 if provided
  const contentSha = req.headers['x-content-sha256'] as string
  if (contentSha) {
    const bodyHash = createHash('sha256').update(JSON.stringify(req.body)).digest('hex')
    if (bodyHash !== contentSha) {
      return next(new AppError('Webhook payload integrity check failed', 400))
    }
  }

  next()
}
```

### Zod Schemas for Webhook Payloads

```typescript
// src/v2/mrv/schema/mrv.schema.ts
import { z } from 'zod'

// CraftedClimate Worker 2 payload
export const verificationWebhookSchema = z.object({
  body: z.object({
    verification_event_id: z.string(),
    methodology_applied:   z.string(),
    verification_status:   z.enum(['SUCCESS', 'FLAGGED', 'FAILED']),
    ai_inference_results: z.object({
      model_id:         z.string(),
      confidence_score: z.number().min(0).max(1),
      is_anomalous:     z.boolean(),
      prediction_class: z.string(),
    }),
    carbon_accounting: z.object({
      gross_removals_tCO2e:  z.number().nullable(),
      leakage_deduction:     z.number().nullable(),
      buffer_contribution:   z.number().nullable(),
      net_credits_issued:    z.number().nullable(),
    }),
    validation_checks: z.object({
      geo_fence_status:   z.enum(['VALID', 'INVALID']),
      hardware_integrity: z.enum(['SECURE', 'COMPROMISED']),
    }),
    // Crevy adds this mapping when registering the ingestion
    cc_ingestion_id: z.string(),
  })
})

// CraftedClimate Worker 3 payload
export const blockchainWebhookSchema = z.object({
  body: z.object({
    blockchain_anchor: z.object({
      network:          z.string(),
      contract_address: z.string(),
      transaction_hash: z.string(),
      block_height:     z.number(),
    }),
    on_chain_metadata: z.object({
      project_id:   z.string(),
      vintage:      z.string(),
      batch_id:     z.string(),
      merkle_root:  z.string(),
      audit_uri:    z.string(),
    }),
    // Crevy maps this from cc_ingestion_id
    verification_event_id: z.string(),
  })
})

// Register a sensor/ingestion event
export const registerIngestionSchema = z.object({
  body: z.object({
    projectId: z.string().uuid(),
    plotId:    z.string().uuid(),
    farmerId:  z.string().uuid(),
    partnerId: z.number().int().positive(),
    deviceId:  z.string(),
    ccIngestionId: z.string(),
  })
})
```

### MRV Service (`src/v2/mrv/services/mrv.service.ts`)

```typescript
import { db } from '@config/db'
import { eq } from 'drizzle-orm'
import { mrvIngestionEvent } from '../models/mrv-ingestion.model'
import { mrvVerificationResult } from '../models/mrv-verification.model'
import { mrvBlockchainAnchor } from '../models/mrv-blockchain.model'
import CreditService from '../../credits/services/credit.service'
import AppError from '@shared/errors/AppError'

const MrvService = {
  /**
   * Called when an admin registers a new sensor ingestion batch
   * (i.e. when CraftedClimate tells us "device X has been deployed on plot Y")
   */
  registerIngestion: async (data) => {
    const [event] = await db.insert(mrvIngestionEvent).values({
      ccIngestionId:       data.ccIngestionId,
      projectId:           data.projectId,
      plotId:              data.plotId,
      farmerId:            data.farmerId,
      partnerId:           data.partnerId,
      deviceId:            data.deviceId,
      submissionTimestamp: new Date(),
      ingestionStatus:     'pending',
    }).returning()
    return event
  },

  /**
   * Called by the webhook handler when CraftedClimate Worker 2 fires.
   * Stores the verification result and triggers credit issuance on SUCCESS.
   */
  handleVerificationWebhook: async (payload) => {
    // 1. Find the ingestion event by cc_ingestion_id
    const ingestion = await db.query.mrvIngestionEvent.findFirst({
      where: eq(mrvIngestionEvent.ccIngestionId, payload.cc_ingestion_id),
    })
    if (!ingestion) throw new AppError('Ingestion event not found for this cc_ingestion_id', 404)

    // 2. Normalise status (CraftedClimate sends uppercase, DB stores lowercase)
    const status = payload.verification_status.toLowerCase() as 'success' | 'flagged' | 'failed'

    // 3. Insert mrv_verification_result
    const [result] = await db.insert(mrvVerificationResult).values({
      ingestionId:          ingestion.id,
      projectId:            ingestion.projectId,
      verificationEventId:  payload.verification_event_id,
      methodologyApplied:   payload.methodology_applied,
      verificationStatus:   status,
      aiModelId:            payload.ai_inference_results.model_id,
      aiConfidenceScore:    payload.ai_inference_results.confidence_score.toString(),
      isAnomalous:          payload.ai_inference_results.is_anomalous,
      predictionClass:      payload.ai_inference_results.prediction_class,
      geoFenceStatus:       payload.validation_checks.geo_fence_status.toLowerCase() as 'valid' | 'invalid',
      hardwareIntegrity:    payload.validation_checks.hardware_integrity.toLowerCase(),
      grossRemovalsTco2e:   payload.carbon_accounting.gross_removals_tCO2e?.toString() ?? null,
      leakageDeduction:     payload.carbon_accounting.leakage_deduction?.toString() ?? null,
      bufferContribution:   payload.carbon_accounting.buffer_contribution?.toString() ?? null,
      netCreditsIssued:     payload.carbon_accounting.net_credits_issued?.toString() ?? null,
      receivedAt:           new Date(),
    }).returning()

    // 4. Update ingestion event status
    await db.update(mrvIngestionEvent)
      .set({ ingestionStatus: status === 'success' ? 'verified' : status === 'flagged' ? 'flagged' : 'failed' })
      .where(eq(mrvIngestionEvent.id, ingestion.id))

    // 5. If flagged: log notification for admin and project owner, then stop.
    if (status === 'flagged') {
      // TODO: Create notification for admin and farmer
      return { result, creditsIssued: 0 }
    }

    // 6. If success: credits will be issued when the blockchain anchor arrives (Worker 3)
    // We do NOT issue credits on Worker 2 alone — we wait for Worker 3's tx_hash.
    return { result, creditsIssued: 0 }
  },

  /**
   * Called by the webhook handler when CraftedClimate Worker 3 fires.
   * Stores the blockchain anchor and triggers credit issuance.
   */
  handleBlockchainWebhook: async (payload) => {
    // 1. Find the matching verification result
    const verificationResult = await db.query.mrvVerificationResult.findFirst({
      where: eq(mrvVerificationResult.verificationEventId, payload.verification_event_id),
    })
    if (!verificationResult) throw new AppError('Verification result not found', 404)

    // Only issue credits if verification was SUCCESS
    if (verificationResult.verificationStatus !== 'success') {
      throw new AppError('Cannot anchor blockchain for a non-SUCCESS verification', 400)
    }

    // 2. Insert mrv_blockchain_anchor
    const [anchor] = await db.insert(mrvBlockchainAnchor).values({
      resultId:        verificationResult.id,
      projectId:       verificationResult.projectId,
      network:         payload.blockchain_anchor.network,
      contractAddress: payload.blockchain_anchor.contract_address,
      transactionHash: payload.blockchain_anchor.transaction_hash,
      blockHeight:     payload.blockchain_anchor.block_height,
      batchId:         payload.on_chain_metadata.batch_id,
      vintage:         parseInt(payload.on_chain_metadata.vintage),
      merkleRoot:      payload.on_chain_metadata.merkle_root,
      auditUri:        payload.on_chain_metadata.audit_uri,
      anchoredAt:      new Date(),
    }).returning()

    // 3. Issue carbon credits
    const creditsIssued = await CreditService.issueCredits({
      projectId:       verificationResult.projectId,
      netCreditsIssued: parseFloat(verificationResult.netCreditsIssued!),
      batchId:         anchor.batchId,
      vintage:         anchor.vintage,
      blockchainTxHash: anchor.transactionHash,
      verificationDate: new Date().toISOString().split('T')[0],
    })

    return { anchor, creditsIssued }
  },

  getIngestionStatus: async (ccIngestionId: string) => {
    const event = await db.query.mrvIngestionEvent.findFirst({
      where: eq(mrvIngestionEvent.ccIngestionId, ccIngestionId),
      with: { project: true, farmPlot: true },
    })
    if (!event) throw new AppError('Ingestion event not found', 404)
    return event
  },
}

export default MrvService
```

### TDD Tests (`src/v2/mrv/tests/mrv.test.ts`)

```typescript
describe('MRV Module', () => {

  describe('POST /api/v2/mrv/webhook/verification', () => {
    it('should store verification result for SUCCESS status', async () => {
      const payload = {
        verification_event_id: 'v-verify-uuid-00001',
        methodology_applied: 'Verra VM0042 v2.2',
        verification_status: 'SUCCESS',
        ai_inference_results: { model_id: 'CC_ML_V4', confidence_score: 0.9982, is_anomalous: false, prediction_class: 'baseline_consistent' },
        carbon_accounting: { gross_removals_tCO2e: 0.000142, leakage_deduction: 0.000002, buffer_contribution: 0.000010, net_credits_issued: 0.000130 },
        validation_checks: { geo_fence_status: 'VALID', hardware_integrity: 'SECURE' },
        cc_ingestion_id: 'msg-ingest-uuid-99211044',
      }
      const res = await request(app)
        .post('/api/v2/mrv/webhook/verification')
        .set('Authorization', `Bearer ${process.env.CC_WEBHOOK_SECRET}`)
        .send(payload)
      expect(res.status).toBe(200)
    })

    it('should return 401 without webhook secret', async () => {
      const res = await request(app).post('/api/v2/mrv/webhook/verification').send({})
      expect(res.status).toBe(401)
    })

    it('should NOT issue credits for FLAGGED status', async () => {
      // ... send flagged payload, then query carbon_credits count — should be 0
    })

    it('should update ingestion_status to flagged when FLAGGED', async () => {
      // ... send flagged payload, then GET ingestion status — should be 'flagged'
    })
  })

  describe('POST /api/v2/mrv/webhook/blockchain', () => {
    it('should store blockchain anchor and issue credits on SUCCESS', async () => {
      // Requires a prior SUCCESS verification result in the DB
      // After this webhook fires, carbon_credit rows should exist
      const res = await request(app)
        .post('/api/v2/mrv/webhook/blockchain')
        .set('Authorization', `Bearer ${process.env.CC_WEBHOOK_SECRET}`)
        .send({ /* Worker 3 payload */ })
      expect(res.status).toBe(200)
      expect(res.body.data.creditsIssued).toBeGreaterThan(0)
    })
  })

  describe('GET /api/v2/mrv/ingestions/:ccIngestionId/status', () => {
    it('should return ingestion event status', async () => {
      const res = await request(app)
        .get('/api/v2/mrv/ingestions/msg-ingest-uuid-99211044/status')
        .set('Authorization', 'Bearer <admin_token>')
      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('ingestionStatus')
    })
  })
})
```

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v2/mrv/ingestions` | Admin | Register a sensor ingestion event |
| `GET` | `/api/v2/mrv/ingestions` | Admin | List all ingestion events |
| `GET` | `/api/v2/mrv/ingestions/:ccIngestionId/status` | Admin | Get status of a specific ingestion |
| `POST` | `/api/v2/mrv/webhook/verification` | CC Webhook Secret | CraftedClimate Worker 2 webhook |
| `POST` | `/api/v2/mrv/webhook/blockchain` | CC Webhook Secret | CraftedClimate Worker 3 webhook |
| `GET` | `/api/v2/mrv/verifications/:projectId` | Auth | Get all verification results for a project |
| `GET` | `/api/v2/mrv/anchors/:projectId` | Auth | Get all blockchain anchors for a project |

---

## 13. Module 7: Carbon Credits & Transactions

### What this module covers

Credit issuance (triggered by MRV), marketplace browsing, credit purchase (creating transactions), and credit retirement.

### Key business rules

1. Credits are ONLY issued by `CreditService.issueCredits()`, called from `MrvService.handleBlockchainWebhook()`. **Never** issue credits from any other code path.
2. A credit with `credit_status = 'sold'` or `'retired'` cannot be sold again.
3. `total_amount` in `credit_transaction` is locked at creation — it is `quantity × price_per_credit`. Never update it.
4. When `credit_transaction.status` transitions to `'completed'`, automatically create a `payout` record (see Module 8).
5. The serial number format: `CRV-{COUNTRY}-{VINTAGE}-{SEQ}` — e.g. `CRV-GH-2026-000001`.

### Credit Service (`src/v2/credits/services/credit.service.ts`)

```typescript
const CreditService = {
  /**
   * Atomically issues carbon credits from a verified dMRV batch.
   * Called ONLY by MrvService.handleBlockchainWebhook().
   * Creates one carbon_credit row per unit of net_credits_issued.
   */
  issueCredits: async (params: {
    projectId: string;
    netCreditsIssued: number;
    batchId: string;
    vintage: number;
    blockchainTxHash: string;
    verificationDate: string;
  }) => {
    // 1. Find the project and its primary farmer to set current_owner_id
    // 2. Generate serial numbers: CRV-GH-2026-000001, 000002, etc.
    // 3. In a transaction, insert all credit rows atomically
    // 4. For fractional credits (e.g. 0.00013), issue 1 row with credit_amount = 0.00013
    //    rather than trying to issue fractional unit counts
    // 5. Return count of credits issued
  },

  purchaseCredits: async (params: {
    buyerId: string;
    projectId: string;
    quantity: number;
    pricePerCredit: number;
    currencyId: number;
    notes?: string;
  }) => {
    return db.transaction(async (tx) => {
      // 1. Find available credits for the project (status = 'available')
      // 2. Check enough credits exist for the requested quantity
      // 3. Create credit_transaction record (status = 'pending')
      // 4. Update selected credit rows: status = 'reserved', transaction_id = new transaction id
      // 5. Update credit_transaction status to 'completed'
      // 6. Update credit rows: status = 'sold', current_owner_id = buyerId
      // 7. Trigger payout creation (call FinancialService.createPayout())
      // 8. Return transaction record
    })
  },

  retireCredit: async (creditId: string, retiredBy: string) => {
    // 1. Check credit status is 'available' or 'sold' (not already retired/invalidated)
    // 2. Update status to 'retired'
    // 3. Log to audit_log
  },

  getAvailableCredits: async (filters: { projectId?: string; vintage?: number; status?: string }, pagination) => {
    // Query carbon_credit with filters, joined with project data
  },
}
```

### TDD Tests (abbreviated)

```typescript
describe('Credits Module', () => {
  describe('CreditService.issueCredits()', () => {
    it('should issue the correct number of credit rows', ...)
    it('should set credit_status to available', ...)
    it('should set current_owner_id to the project primary farmer', ...)
    it('should store the blockchain_tx_hash on each credit', ...)
  })

  describe('POST /api/v2/credits/purchase', () => {
    it('should create a transaction and mark credits as sold', ...)
    it('should return 400 if insufficient credits available', ...)
    it('should create a payout record after successful purchase', ...)
    it('should return 401 if not authenticated', ...)
  })

  describe('PATCH /api/v2/credits/:id/retire', () => {
    it('should retire an available credit', ...)
    it('should return 400 for already-retired credit', ...)
  })

  describe('GET /api/v2/credits', () => {
    it('should return paginated available credits', ...)
    it('should filter by vintage year', ...)
    it('should filter by project type', ...)
  })
})
```

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v2/credits` | Auth | Browse available credits (marketplace) |
| `GET` | `/api/v2/credits/:id` | Auth | Get a single credit by ID |
| `POST` | `/api/v2/credits/purchase` | Auth | Purchase credits (creates transaction) |
| `GET` | `/api/v2/credits/transactions` | Auth | List user's transactions |
| `GET` | `/api/v2/credits/transactions/:id` | Auth | Get transaction details |
| `PATCH` | `/api/v2/credits/:id/retire` | Admin | Retire a credit |
| `GET` | `/api/v2/credits/portfolio` | Auth | Get buyer's purchased credit portfolio |
| `GET` | `/api/v2/credits/verifications` | Admin | List all verifications |
| `GET` | `/api/v2/credits/verifications/:projectId` | Auth | Get verifications for a project |

---

## 14. Module 8: Financials

### What this module covers

Farmer payouts, platform financial records, and long-term contracts.

### Key business rules

1. A `payout` is created automatically when `credit_transaction.status` → `'completed'` for a non-internal sale. Do NOT expose a public "create payout" endpoint.
2. The payout amount = `total_amount` minus the platform fee percentage (configurable via env var `PLATFORM_FEE_PERCENTAGE`).
3. A `financial_record` of type `platform_fee` is created alongside every payout.
4. `contract_ref` format: `CTR-{YEAR}-{SEQ}`.

### Payout Flow

```typescript
// Called inside CreditService.purchaseCredits() after status = 'completed'
const FinancialService = {
  createPayoutFromTransaction: async (transactionId: string, tx) => {
    // 1. Load transaction with farmer and project data
    // 2. Calculate payout_amount = total_amount * (1 - PLATFORM_FEE_PERCENTAGE)
    // 3. Calculate platform_fee = total_amount * PLATFORM_FEE_PERCENTAGE
    // 4. Insert payout record (status = 'pending')
    // 5. Insert financial_record (type = 'platform_fee', amount = platform_fee)
    // Both in the same DB transaction as the credit purchase
  },

  updatePayoutStatus: async (payoutId: string, status: 'completed' | 'failed') => {
    // Admin manually confirms disbursement (or an external payment webhook updates this)
  },
}
```

### TDD Tests (abbreviated)

```typescript
describe('Financials Module', () => {
  describe('Payout creation (via purchase flow)', () => {
    it('should automatically create a payout when credits are purchased', ...)
    it('should deduct platform fee from payout amount', ...)
    it('should create a financial_record for the platform fee', ...)
    it('payout status should start as pending', ...)
  })

  describe('PATCH /api/v2/financials/payouts/:id/status', () => {
    it('should update payout status to completed', ...)
    it('should return 400 for invalid status', ...)
  })

  describe('POST /api/v2/financials/contracts', () => {
    it('should create an offtake contract in draft status', ...)
    it('should generate a unique contract_ref', ...)
  })

  describe('GET /api/v2/financials/payouts', () => {
    it('should return paginated payouts for a farmer', ...)
  })
})
```

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v2/financials/payouts` | Auth | List payouts (farmer sees own, admin sees all) |
| `GET` | `/api/v2/financials/payouts/:id` | Auth | Get payout detail |
| `PATCH` | `/api/v2/financials/payouts/:id/status` | Admin | Update payout status (confirm disbursement) |
| `GET` | `/api/v2/financials/records` | Admin | List financial records |
| `POST` | `/api/v2/financials/contracts` | Admin | Create a contract |
| `GET` | `/api/v2/financials/contracts` | Auth | List contracts |
| `GET` | `/api/v2/financials/contracts/:id` | Auth | Get contract detail |
| `PATCH` | `/api/v2/financials/contracts/:id/status` | Admin | Update contract status |

---

## 15. Module 9: Audit, Notifications & Health

### Audit Log

The audit log is write-only from the application layer. Never expose a public "create audit log" endpoint.

Create an Express middleware `src/middleware/auditLog.middleware.ts`:

```typescript
/**
 * Audit Log Middleware
 * Usage: Add to specific routes that need audit logging.
 * Example: router.patch('/:id/status', requireAuth, auditLog('project', 'status_changed'), ProjectController.updateStatus)
 */
export const auditLog = (tableName: string, action: string) =>
  async (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res)
    res.json = (body) => {
      // After response is sent, log to audit_log table
      if (res.statusCode >= 200 && res.statusCode < 300) {
        db.insert(auditLogTable).values({
          actorId:   req.user?.id ?? null,
          action:    action,
          tableName: tableName,
          recordId:  req.params.id ?? body?.data?.id ?? 'unknown',
          newValues: body?.data ? JSON.stringify(body.data) : null,
          ipAddress: req.ip,
        }).catch(console.error) // fire and forget — never block response
      }
      return originalJson(body)
    }
    next()
  }
```

### Notifications Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v2/notifications` | Auth | Get user's notifications (unread first) |
| `PATCH` | `/api/v2/notifications/:id/read` | Auth | Mark notification as read |
| `PATCH` | `/api/v2/notifications/read-all` | Auth | Mark all notifications as read |

### Health Endpoint

```typescript
// src/v2/health/health.route.ts
healthRouter.get('/', (req, res) => {
  res.status(200).json({ success: true, message: 'Crevy API v2 is healthy', timestamp: new Date().toISOString() })
})
```

---

## 16. Middleware Reference

All middleware from v1 carries forward unchanged. The new additions are:

| Middleware | Location | Purpose |
|---|---|---|
| `requireAuth` | `src/middleware/auth.middleware.ts` | Validates better-auth session. Attaches `req.user`. |
| `optionalAuth` | `src/middleware/auth.middleware.ts` | Attaches `req.user` if session exists, does not block. |
| `validateInboundRequest(schema)` | `src/middleware/validateInboundRequest.middleware.ts` | Validates `req.body`, `req.params`, `req.query` against Zod schema. |
| `requireMrvWebhookAuth` | `src/v2/mrv/middleware/mrv-webhook.middleware.ts` | NEW — validates CraftedClimate webhook auth + content SHA. |
| `auditLog(tableName, action)` | `src/middleware/auditLog.middleware.ts` | NEW — writes to audit_log table after successful responses. |
| `requirePermission(resource, action)` | `src/middleware/permission.middleware.ts` | NEW — calls `RbacService.hasPermission()` to enforce RBAC. |

### `requirePermission` Middleware

```typescript
// src/middleware/permission.middleware.ts
import { Request, Response, NextFunction } from 'express'
import RbacService from '@v2/rbac/services/rbac.service'
import AppError from '@shared/errors/AppError'

export const requirePermission = (resource: string, action: string) =>
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Authentication required', 401))

    const allowed = await RbacService.hasPermission(req.user.id, resource, action)
    if (!allowed) return next(new AppError('You do not have permission to perform this action', 403))

    next()
  }
```

---

## 17. TDD Strategy — How to Write Tests

### The Red-Green-Refactor cycle

1. **Red:** Write a failing test for the behaviour you are about to implement.
2. **Green:** Write the minimum code to make the test pass.
3. **Refactor:** Clean up the code without breaking the tests.

### Test categories

| Category | What to test | Example |
|---|---|---|
| **Unit** | Individual service functions in isolation (mock the DB) | `RbacService.createRole()` |
| **Integration** | Full HTTP request through Express → Controller → Service → DB | `POST /api/v2/farmers` |
| **Edge cases** | Invalid inputs, missing fields, duplicate data, unauthorised access | `401`, `409`, `400` responses |
| **Business rules** | Platform-specific invariants | "Cannot enroll plot not verified" |

### Test helpers to create once and reuse

```typescript
// src/tests/helpers/auth.helper.ts
import request from 'supertest'
import app from '../../index'

/**
 * Register and login a test user, return the session cookie or token.
 * Reuse in every test that needs authentication.
 */
export const getAuthToken = async (role: 'admin' | 'farmer' | 'company' = 'admin') => {
  const email = `test-${role}-${Date.now()}@crevy.io`
  await request(app).post('/api/v2/auth/register').send({
    email, password: 'TestPass123!', firstName: 'Test', lastName: 'User'
  })
  const loginRes = await request(app).post('/api/auth/sign-in/email').send({
    email, password: 'TestPass123!'
  })
  // better-auth returns a session cookie — extract it
  return loginRes.headers['set-cookie']
}
```

### Test database strategy

Use a separate `crevy_test` database. Add to `.env.test`:

```
DATABASE_URL=postgresql://localhost:5432/crevy_test
```

Vitest loads `.env.test` automatically when running in test mode.

In `vitest.config.ts`, set:
```typescript
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
```

Each test file should clean its own tables in `beforeEach`:

```typescript
beforeEach(async () => {
  await db.delete(rolePermission)
  await db.delete(permission)
  await db.delete(role)
})
```

---

## 18. Complete API Endpoint Reference

### Base URL: `/api/v2`

#### Auth (`/auth`)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | Public | Register user |
| GET | `/auth/me` | Auth | Get own profile |
| PUT | `/auth/me` | Auth | Update own profile |
| GET | `/auth/currencies` | Public | List currencies |
| POST | `/auth/currencies` | Admin | Create currency |

#### RBAC (`/rbac`)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/rbac/roles` | Admin | Create role |
| GET | `/rbac/roles` | Admin | List roles |
| POST | `/rbac/permissions` | Admin | Create permission |
| GET | `/rbac/permissions` | Admin | List permissions |
| POST | `/rbac/roles/:roleId/permissions` | Admin | Assign permission to role |
| POST | `/rbac/users/assign-role` | Admin | Assign role to user |
| GET | `/rbac/users/:userId/roles` | Admin | Get user's roles |

#### Partners (`/partners`)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/partners` | Admin | Create partner |
| GET | `/partners` | Admin | List partners |
| GET | `/partners/:id` | Admin | Get partner |
| PUT | `/partners/:id` | Admin | Update partner |
| PATCH | `/partners/:id/status` | Admin | Change partner status |

#### Farmers (`/farmers`)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/farmers` | Admin/Agent | Create farmer profile |
| GET | `/farmers` | Admin | List farmers |
| GET | `/farmers/:id` | Admin/Agent | Get farmer |
| PUT | `/farmers/:id` | Admin/Agent | Update farmer |
| PATCH | `/farmers/:id/verification` | Admin | Update KYC status |
| POST | `/farmers/:id/plots` | Admin/Agent | Register plot |
| GET | `/farmers/:id/plots` | Admin/Agent | List farmer plots |
| GET | `/farmers/plots/:plotId` | Auth | Get single plot |
| PATCH | `/farmers/plots/:plotId/boundary` | Admin/Agent | Update plot boundary |
| POST | `/farmers/:id/assignments` | Admin | Assign agent |
| GET | `/farmers/:id/assignments` | Admin | Get assignments |

#### Projects (`/projects`)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/projects` | Auth | Create project |
| GET | `/projects` | Auth | List own projects |
| GET | `/projects/marketplace` | Public | Marketplace listings |
| GET | `/projects/:id` | Auth | Get project |
| PUT | `/projects/:id` | Auth | Update project |
| PATCH | `/projects/:id/activate` | Admin | Activate project |
| POST | `/projects/:id/farmers` | Admin | Enroll farmer |
| GET | `/projects/:id/farmers` | Auth | List enrolled farmers |
| POST | `/projects/:id/plots` | Admin | Enroll plot |
| GET | `/projects/:id/plots` | Auth | List enrolled plots |
| POST | `/projects/:id/activities` | Admin | Log activity |
| GET | `/projects/:id/activities` | Auth | Get activity log |

#### MRV (`/mrv`)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/mrv/ingestions` | Admin | Register ingestion event |
| GET | `/mrv/ingestions` | Admin | List ingestion events |
| GET | `/mrv/ingestions/:ccIngestionId/status` | Admin | Get ingestion status |
| POST | `/mrv/webhook/verification` | CC Webhook | Worker 2 webhook |
| POST | `/mrv/webhook/blockchain` | CC Webhook | Worker 3 webhook |
| GET | `/mrv/verifications/:projectId` | Auth | Project verifications |
| GET | `/mrv/anchors/:projectId` | Auth | Project blockchain anchors |

#### Credits (`/credits`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/credits` | Auth | Browse available credits |
| GET | `/credits/:id` | Auth | Get single credit |
| POST | `/credits/purchase` | Auth | Purchase credits |
| GET | `/credits/transactions` | Auth | List transactions |
| GET | `/credits/transactions/:id` | Auth | Get transaction |
| PATCH | `/credits/:id/retire` | Admin | Retire credit |
| GET | `/credits/portfolio` | Auth | Buyer portfolio |
| GET | `/credits/verifications` | Admin | All verifications |
| GET | `/credits/verifications/:projectId` | Auth | Project verifications |

#### Financials (`/financials`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/financials/payouts` | Auth | List payouts |
| GET | `/financials/payouts/:id` | Auth | Get payout |
| PATCH | `/financials/payouts/:id/status` | Admin | Update payout status |
| GET | `/financials/records` | Admin | List financial records |
| POST | `/financials/contracts` | Admin | Create contract |
| GET | `/financials/contracts` | Auth | List contracts |
| GET | `/financials/contracts/:id` | Auth | Get contract |
| PATCH | `/financials/contracts/:id/status` | Admin | Update contract status |

#### Notifications
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/notifications` | Auth | Get notifications |
| PATCH | `/notifications/:id/read` | Auth | Mark as read |
| PATCH | `/notifications/read-all` | Auth | Mark all as read |

---

## 19. Database Migrations & Seeding

### Step 1: Run PostGIS extensions and SQL constraints manually

Some SQL in `DB_Redesign.sql` cannot be generated by drizzle-kit:
- PostGIS extensions (`CREATE EXTENSION IF NOT EXISTS postgis`)
- GIST spatial indexes
- The partial unique index `idx_project_plot_no_double_enrollment`
- The DB functions `find_plot_for_sensor_reading()`, `generate_buffered_boundary()`, `calculated_area_hectares()`
- The view `farmer_project_land_summary`

```bash
# Run the raw SQL on your database BEFORE running drizzle migrations
psql $DATABASE_URL -f planning/DB_Redesign.sql
```

### Step 2: Generate and run Drizzle migrations

```bash
# Ensure drizzle.config.ts points to src/v2/schema.ts
pnpm db:generate

# Apply migrations
pnpm drizzle-kit migrate
```

### Step 3: Seed data

Create `src/v2/seed.ts`:

```typescript
// src/v2/seed.ts
import { db } from '@config/db'
import { role } from './rbac/models/rbac.model'
import { permission } from './rbac/models/rbac.model'
import { currency } from './auth/models/currency.model'
import { partner } from './partners/models/partner.model'

async function seed() {
  console.log('🌱 Seeding database...')

  // 1. Currencies
  await db.insert(currency).values([
    { code: 'USD', name: 'US Dollar' },
    { code: 'GHS', name: 'Ghanaian Cedi' },
    { code: 'EUR', name: 'Euro' },
    { code: 'KES', name: 'Kenyan Shilling' },
    { code: 'NGN', name: 'Nigerian Naira' },
  ]).onConflictDoNothing()

  // 2. Roles
  await db.insert(role).values([
    { name: 'admin',          description: 'Full platform access' },
    { name: 'farmer',         description: 'Project owner / green project lead' },
    { name: 'company_buyer',  description: 'Corporate carbon credit buyer' },
    { name: 'field_agent',    description: 'Manages farmer onboarding in the field' },
    { name: 'verifier',       description: 'Third-party verification officer' },
    { name: 'partner_agent',  description: 'Agent working for a partner organisation' },
  ]).onConflictDoNothing()

  // 3. Core Permissions (resource × action matrix)
  const resources = ['projects', 'credits', 'farmers', 'plots', 'mrv', 'financials', 'rbac', 'partners']
  const actions   = ['create', 'read', 'update', 'delete', 'approve', 'manage']
  const perms = resources.flatMap(r => actions.map(a => ({ resource: r, action: a })))
  await db.insert(permission).values(perms).onConflictDoNothing()

  // 4. Seed CraftedClimate as the first partner
  await db.insert(partner).values({
    name:                    'CraftedClimate',
    code:                    'CC',
    partnerType:             'dMRV_provider',
    contactPerson:           'CraftedClimate API',
    contactEmail:            'api@craftedclimate.com',
    country:                 'Kenya',
    status:                  'approved',
    hasDataSharingAgreement: true,
  }).onConflictDoNothing()

  console.log('✅ Seeding complete')
  process.exit(0)
}

seed().catch(console.error)
```

Add to `package.json`:

```json
"db:seed": "tsx src/v2/seed.ts"
```

---

## 20. Environment Variables

Create `.env` (never commit this file):

```bash
# App
NODE_ENV=development
APP_PORT=4000
FRONTEND_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://localhost:5432/crevy_dev
TEST_DATABASE_URL=postgresql://localhost:5432/crevy_test

# better-auth
BETTER_AUTH_SECRET=your-32-char-random-secret-here
BETTER_AUTH_URL=http://localhost:3000/api/auth

# CraftedClimate dMRV Integration
CC_WEBHOOK_SECRET=crafted-climate-webhook-secret-here
CC_API_BASE_URL=https://api.craftedclimate.com
CC_PARTNER_TOKEN=your-bearer-token-scoped-to-partner-project-id

# Business Config
PLATFORM_FEE_PERCENTAGE=0.05   # 5% platform fee on credit sales

# Misc
SALT_WORK_FACTOR=10
```

---

## 21. Frontend Handoff Checklist

Once all modules are implemented and tests pass, do the following before handing off to the frontend team:

1. **Generate OpenAPI spec** — better-auth includes the `openAPI()` plugin. Mount it:
   ```typescript
   app.get('/api/v2/openapi', (req, res) => res.json(auth.openAPI()))
   ```
   For custom endpoints, add swagger-jsdoc or generate manually.

2. **Run full test suite** — All tests must pass: `pnpm test`

3. **Coverage report** — `pnpm test:coverage` — aim for > 80% coverage on service layer.

4. **Postman / Insomnia collection** — Export all endpoints with example request bodies and expected responses.

5. **Staging deployment** — Deploy v2 to the staging environment. Smoke-test all critical flows:
   - Register → Login → Create project → Enroll farmer → Enroll plot → Trigger mock MRV webhook → Verify credits issued → Purchase credits → Check payout created.

6. **API changelog** — Write a `CHANGELOG.md` listing what is new vs v1 and what has been removed.

---

## 22. Progress Tracker

Use this section to track completion. Update as modules are built.

### Phase 1 — Foundation (Week 1)

- [ ] Create `feat/v2-backend-redesign` branch
- [ ] Install vitest, supertest, configure `vitest.config.ts`
- [ ] Run `DB_Redesign.sql` on dev database to create extensions, functions, indexes
- [ ] Update `drizzle.config.ts` to point to `src/v2/schema.ts`
- [ ] Build all Drizzle models (Section 6) — verify with `pnpm db:generate`
- [ ] Create `src/v2/schema.ts` barrel
- [ ] Mount v2Router in `src/index.ts`
- [ ] Create seed file and run: `pnpm db:seed`

### Phase 2 — RBAC & Auth (Week 1–2)

- [ ] RBAC models, schemas, tests, service, controller, routes
- [ ] Auth models (user, currency), schemas, tests, service, controller, routes
- [ ] `requirePermission` middleware
- [ ] All tests passing: `pnpm test`

### Phase 3 — Partners & Farmers (Week 2)

- [ ] Partners module (models, schemas, tests, service, controller, routes)
- [ ] Farmers module — farmer profile, farm_plot, farmer_assignment
- [ ] Farmer code auto-generation
- [ ] Buffered boundary logic for plots
- [ ] All tests passing

### Phase 4 — Projects (Week 2–3)

- [ ] Projects module — project, project_farmer, project_plot, project_activity
- [ ] Project code auto-generation (maps to CC-PROJECT-ID)
- [ ] Plot enrollment business rules (verified-only, no double-enrollment)
- [ ] Project activation flow
- [ ] All tests passing

### Phase 5 — MRV Integration (Week 3) — Critical Path

- [ ] MRV models (ingestion, verification, blockchain)
- [ ] `requireMrvWebhookAuth` middleware
- [ ] Webhook handler for Worker 2 (verification)
- [ ] Webhook handler for Worker 3 (blockchain + credit issuance trigger)
- [ ] Credit issuance logic wired to blockchain webhook
- [ ] All tests passing — including webhook tests with mock CraftedClimate payloads

### Phase 6 — Credits & Financials (Week 3–4)

- [ ] Carbon credit model and `CreditService.issueCredits()`
- [ ] Credit transaction (purchase flow)
- [ ] `FinancialService.createPayoutFromTransaction()` (auto-triggered on purchase)
- [ ] Contracts module
- [ ] All tests passing

### Phase 7 — Audit, Notifications, Polish (Week 4)

- [ ] Audit log middleware applied to all state-changing routes
- [ ] Notifications module
- [ ] Full test suite: `pnpm test:coverage` — target > 80%
- [ ] OpenAPI spec / Postman collection generated
- [ ] Staging deployment + smoke test
- [ ] Frontend handoff

---

> **If this document is being continued by another agent:**
>
> **What has been documented:**
> All 22 sections above are written. Section 6 covers all 25 Drizzle models in detail. Sections 7–14 cover all 8 domain modules with schemas, services, controllers, routes, and TDD tests.
>
> **What still needs to be IMPLEMENTED (not documented — documented above, code not yet written):**
> - All files in `src/v2/` need to be created as actual TypeScript files on disk
> - `src/tests/setup.ts` and `vitest.config.ts` need to be written to disk
> - `src/v2/seed.ts` needs to be written to disk
> - The `src/index.ts` needs to be updated to mount v2Router
> - `drizzle.config.ts` needs to be updated to point to v2 schema
>
> **To continue:** Start from Section 6 — write each model file to disk using `filesystem:write_file`, then work through each module (Sections 7–14) writing the actual service, controller, route, schema, and test files. Follow the code samples in this document exactly.

---

*Documentation prepared: May 2026 · Crevy Platform · Foovante Global*
