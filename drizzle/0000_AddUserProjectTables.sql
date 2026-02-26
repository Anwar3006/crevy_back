-- Comment out after running once
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

CREATE TYPE "public"."project_status_enum" AS ENUM('draft', 'submitted', 'under_review', 'approved', 'rejected', 'active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."project_type_enum" AS ENUM('regenerative_agriculture', 'renewable_energy', 'waste_management', 'biochar', 'reforestation', 'blue_carbon', 'other');--> statement-breakpoint
CREATE TYPE "public"."user_type" AS ENUM('ProjectOwner', 'Company');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carbon_sequestration_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"year" integer NOT NULL,
	"measured_value" numeric(12, 4),
	"calculated_tco2e" numeric(12, 4),
	"verification_status" varchar DEFAULT 'pending',
	"verified_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company" (
	"user_id" text PRIMARY KEY NOT NULL,
	"legal_business_name" varchar(100) NOT NULL,
	"business_address" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project" (
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
	"sdgs" text,
	"region" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"submitted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "project_document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"document_type" varchar NOT NULL,
	"file_name" varchar NOT NULL,
	"file_path" varchar NOT NULL,
	"file_size" integer NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_owner" (
	"user_id" text PRIMARY KEY NOT NULL,
	"project_category" varchar(255),
	"project_start_date" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_practices" (
	"project_id" uuid NOT NULL,
	"practice_id" uuid NOT NULL,
	"impact_factor_at_signing" numeric(10, 6),
	"area_hectare" numeric(12, 4) NOT NULL,
	"intensity" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_practices_project_id_practice_id_pk" PRIMARY KEY("project_id","practice_id")
);
--> statement-breakpoint
CREATE TABLE "regenerative_practices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"carbon_impact_factor" numeric(10, 6),
	"unit" varchar DEFAULT 'tCO2e/ha/year',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "regenerative_practices_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"first_name" varchar(50) NOT NULL,
	"last_name" varchar(50) NOT NULL,
	"contact_number" varchar(20),
	"country_of_operation" varchar(100),
	"user_type" "user_type" NOT NULL,
	"profile_completed" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carbon_sequestration_log" ADD CONSTRAINT "carbon_sequestration_log_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company" ADD CONSTRAINT "company_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_document" ADD CONSTRAINT "project_document_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_owner" ADD CONSTRAINT "project_owner_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_practices" ADD CONSTRAINT "project_practices_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_practices" ADD CONSTRAINT "project_practices_practice_id_regenerative_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."regenerative_practices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "project_year_idx" ON "carbon_sequestration_log" USING btree ("project_id","year");--> statement-breakpoint
CREATE INDEX "user_id_idx" ON "project" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "status_idx" ON "project" USING btree ("status");--> statement-breakpoint
CREATE INDEX "project_doc_idx" ON "project_document" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "pp_project_id_idx" ON "project_practices" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");