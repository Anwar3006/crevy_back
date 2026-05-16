import { pgTable, pgEnum, uuid, varchar, decimal, boolean, timestamp, index, customType } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { projectOwner } from './project_owner.model'
import { uuidv7PK } from '@/shared/utils/id'


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
  id:                       uuid('id').primaryKey().$defaultFn(uuidv7PK),
  projectOwnerId:           uuid('project_owner_id').notNull().references(() => projectOwner.id, { onDelete: 'cascade' }),
  country:                  varchar('country', { length: 100 }).notNull(),
  region:                   varchar('region', { length: 100 }).notNull(),
  village:                  varchar('village', { length: 100 }),
  centroid:                 geographyPoint('centroid').notNull(),
  boundary:                 geographyPolygon('boundary'),
  boundaryCollectionMethod: boundaryCollectionMethodEnum('boundary_collection_method'),
  areaHectares:             decimal('area_hectares', { precision: 10, scale: 2 }).notNull(),
  boundaryVerified:         boolean('boundary_verified').notNull().default(false),
  deviceId:                 varchar('device_id', { length: 100 }).unique(),
  createdAt:                timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:                timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index('idx_farm_plot_farmer_id').on(t.projectOwnerId),
  // GIST indexes for spatial queries
  index('idx_farm_plot_boundary').using("gist", t.boundary),
  index('idx_farm_plot_centroid').using("gist", t.centroid),
])

export const farmPlotRelations = relations(farmPlot, ({ one }) => ({
  farmer: one(projectOwner, { fields: [farmPlot.projectOwnerId], references: [projectOwner.id] }),
}))