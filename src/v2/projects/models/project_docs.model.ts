// src/v2/projects/models/project_document.model.ts

import { sql } from "drizzle-orm"
import { 
  boolean, 
  integer, 
  pgEnum, 
  pgTable, 
  text, 
  timestamp, 
  uuid, 
  varchar, 
  index 
} from "drizzle-orm/pg-core"
import { uuidv7PK } from "@/shared/utils/id"
import { project } from "./project.model"

export const documentTypeEnum = pgEnum('document_type_enum', [
  'land_ownership',           // proof of land rights — REQUIRED
  'community_consent',        // signed dMRV participation consent — REQUIRED
  'site_access_authorization',// permission for sensor deployment team — REQUIRED
  'national_id',              // KYC identity document — REQUIRED for farmer verification
  'site_photos',              // recent photographs of the land — OPTIONAL
])

export const projectDocument = pgTable('project_document', {
  id:           uuid('id').primaryKey().$defaultFn(uuidv7PK),
  projectId:    uuid('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
  documentType: documentTypeEnum('document_type').notNull(),
  fileName:     varchar('file_name', { length: 255 }).notNull(),
  fileUrl:      varchar('file_url', { length: 500 }).notNull(),   
  fileSize:     integer('file_size').notNull(),                   
  mimeType:     varchar('mime_type', { length: 100 }),
  uploadedBy:   text('uploaded_by').notNull(),                    
  isVerified:   boolean('is_verified').notNull().default(false),
  verifiedBy:   text('verified_by'),                             
  verifiedAt:   timestamp('verified_at', { withTimezone: true }),
  uploadedAt:   timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // 1. Quick lookups for all documents tied to a single project
  index('idx_project_document_project_id').on(table.projectId),

  // 2. Fetching all files uploaded by a specific user/farmer
  index('idx_project_document_uploaded_by').on(table.uploadedBy),

  // 3. Composite index for verifying if a project has a specific required document type
  index('idx_project_document_project_type').on(table.projectId, table.documentType),

  // 4. Partial index for the admin verification queue (ignores already verified docs)
  index('idx_project_document_unverified')
    .on(table.isVerified)
    .where(sql`is_verified = false`),
])