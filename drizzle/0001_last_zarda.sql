-- 1. Create Enums safely using DO blocks
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_status_enum') THEN
        CREATE TYPE "public"."project_status_enum" AS ENUM(
            'draft', 'submitted', 'under_review', 'approved', 
            'rejected', 'active', 'completed', 'cancelled'
        );
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_type_enum') THEN
        CREATE TYPE "public"."project_type_enum" AS ENUM(
            'regenerative_agriculture', 'renewable_energy', 'waste_management', 
            'biochar', 'reforestation', 'blue_carbon', 'other'
        );
    END IF;
END $$;

-- 2. Create Tables with IF NOT EXISTS
CREATE TABLE IF NOT EXISTS "project" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" text,
    "project_type" "project_type_enum" DEFAULT 'regenerative_agriculture' NOT NULL,
    "name" varchar NOT NULL,
    "gps_coordinates" text,
    "location" varchar NOT NULL,
    "start_date" timestamp NOT NULL,
    "duration_months" integer NOT NULL,
    "status" "project_status_enum" DEFAULT 'draft' NOT NULL,
    "total_area_hectares" numeric(12, 4),
    "baseline_land_use" text,
    "baseline_emissions_yearly" numeric(12, 4),
    "estimated_total_tco2e" numeric(15, 4) DEFAULT '0',
    "verified_total_tco2e" numeric(15, 4) DEFAULT '0',
    "soil_type" varchar,
    "initial_soil_carbon_content" numeric,
    "expected_biomass_increase" text,
    "crop_livestock_types" text,
    "uses_synthetic_fertilizers" boolean DEFAULT false,
    "uses_synthetic_pesticides" boolean DEFAULT false,
    "organic_amendments" text,
    "social_economic_benefits" text,
    "supports_biodiversity_conservation" boolean DEFAULT false,
    "supports_water_management" boolean DEFAULT false,
    "plan_to_expand_practices" varchar,
    "description" text,
    "implementation_plan" text,
    "expected_outcomes" text,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    "submitted_at" timestamp
);

CREATE TABLE IF NOT EXISTS "project_document" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "project_id" uuid,
    "document_type" varchar NOT NULL,
    "file_name" varchar NOT NULL,
    "file_path" varchar NOT NULL,
    "file_size" integer NOT NULL,
    "uploaded_at" timestamp DEFAULT now() NOT NULL,
    "is_verified" boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS "regenerative_practices" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name" varchar NOT NULL,
    "description" text,
    "carbon_impact_factor" numeric(10, 6),
    "unit" varchar DEFAULT 'tCO2e/ha/year',
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "regenerative_practices_name_unique" UNIQUE("name")
);

CREATE TABLE IF NOT EXISTS "project_practices" (
    "project_id" uuid NOT NULL,
    "practice_id" uuid NOT NULL,
    "impact_factor_at_signing" numeric(10, 6),
    "area_hectare" numeric(12, 4) NOT NULL,
    "intensity" varchar NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "project_practices_project_id_practice_id_pk" PRIMARY KEY("project_id","practice_id")
);

-- 3. Add Constraints safely
-- Note: PostgreSQL doesn't have "ADD CONSTRAINT IF NOT EXISTS", 
-- so we use another DO block to prevent errors if the constraint is already there.

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'project_user_id_user_id_fk') THEN
        ALTER TABLE "project" ADD CONSTRAINT "project_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'project_document_project_id_project_id_fk') THEN
        ALTER TABLE "project_document" ADD CONSTRAINT "project_document_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'project_practices_project_id_project_id_fk') THEN
        ALTER TABLE "project_practices" ADD CONSTRAINT "project_practices_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'project_practices_practice_id_regenerative_practices_id_fk') THEN
        ALTER TABLE "project_practices" ADD CONSTRAINT "project_practices_practice_id_regenerative_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."regenerative_practices"("id") ON DELETE restrict ON UPDATE no action;
    END IF;
END $$;

-- 4. Create Indexes safely
CREATE INDEX IF NOT EXISTS "user_id_idx" ON "project" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "status_idx" ON "project" USING btree ("status");
CREATE INDEX IF NOT EXISTS "project_doc_idx" ON "project_document" USING btree ("project_id");
CREATE INDEX IF NOT EXISTS "pp_project_id_idx" ON "project_practices" USING btree ("project_id");