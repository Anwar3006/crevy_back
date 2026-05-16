CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE "public"."assignment_type_enum" AS ENUM('primary', 'secondary');--> statement-breakpoint
CREATE TYPE "public"."partner_status_enum" AS ENUM('pending', 'approved', 'suspended', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."partner_type_enum" AS ENUM('dMRV_provider', 'auditing_body', 'registry', 'channel');--> statement-breakpoint
CREATE TYPE "public"."project_owner_verification_status_enum" AS ENUM('pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."boundary_collection_method_enum" AS ENUM('walked_gps', 'drawn_mobile', 'drawn_web', 'satellite_derived', 'buffered_centroid');--> statement-breakpoint
CREATE TYPE "public"."project_stage_enum" AS ENUM('registration', 'active', 'verification', 'completed');--> statement-breakpoint
CREATE TYPE "public"."project_status_enum" AS ENUM('draft', 'active', 'suspended', 'closed');--> statement-breakpoint
CREATE TYPE "public"."project_type_enum" AS ENUM('regenerative_agriculture', 'reforestation', 'renewable_energy', 'biochar', 'blue_carbon', 'waste_management');--> statement-breakpoint
CREATE TYPE "public"."project_participation_status_enum" AS ENUM('active', 'suspended', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."project_plot_status_enum" AS ENUM('enrolled', 'suspended', 'removed');--> statement-breakpoint
CREATE TYPE "public"."project_activity_status_enum" AS ENUM('planned', 'in_progress', 'completed', 'skipped', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."mrv_ingestion_status_enum" AS ENUM('pending', 'processing', 'verified', 'flagged', 'failed');--> statement-breakpoint
CREATE TYPE "public"."geo_fence_status_enum" AS ENUM('valid', 'invalid');--> statement-breakpoint
CREATE TYPE "public"."verification_status_enum" AS ENUM('success', 'flagged', 'failed');--> statement-breakpoint
CREATE TYPE "public"."credit_status_enum" AS ENUM('available', 'reserved', 'sold', 'retired', 'invalidated');--> statement-breakpoint
CREATE TYPE "public"."transaction_status_enum" AS ENUM('pending', 'completed', 'failed', 'refunded');--> statement-breakpoint
CREATE TABLE "permission" (
	"id" serial PRIMARY KEY NOT NULL,
	"resource" varchar(100) NOT NULL,
	"action" varchar(100) NOT NULL,
	"description" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"description" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "role_permission" (
	"role_id" integer NOT NULL,
	"permission_id" integer NOT NULL,
	"granted_by" text,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_permission_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
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
	"name" text,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"contact_number" text,
	"country_of_operation" text,
	"profile_completed" boolean,
	"default_currency_id" integer,
	"role_id" integer,
	"assigned_by" text,
	"assigned_at" timestamp,
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
CREATE TABLE "currency" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" char(3) NOT NULL,
	"name" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "currency_code_unique" UNIQUE("code"),
	CONSTRAINT "currency_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "partner" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"partner_type" "partner_type_enum" NOT NULL,
	"contact_person" text NOT NULL,
	"contact_email" text NOT NULL,
	"contact_phone" varchar(50),
	"country" varchar(100),
	"status" "partner_status_enum" DEFAULT 'pending' NOT NULL,
	"default_currency_id" integer,
	"has_data_sharing_agreement" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "project_owner" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"code" varchar(50) NOT NULL,
	"verification_status" "project_owner_verification_status_enum" DEFAULT 'pending' NOT NULL,
	"onboarded_by" text,
	"onboarded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"bank_details" jsonb,
	"momo_details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_owner_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "project_owner_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "farm_plot" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_owner_id" uuid NOT NULL,
	"country" varchar(100) NOT NULL,
	"region" varchar(100) NOT NULL,
	"village" varchar(100),
	"centroid" GEOGRAPHY(Point, 4326) NOT NULL,
	"boundary" GEOGRAPHY(Polygon, 4326),
	"boundary_collection_method" "boundary_collection_method_enum",
	"area_hectares" numeric(10, 2) NOT NULL,
	"boundary_verified" boolean DEFAULT false NOT NULL,
	"device_id" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "farm_plot_device_id_unique" UNIQUE("device_id")
);
--> statement-breakpoint
CREATE TABLE "project_owner_assignment" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_owner_id" uuid NOT NULL,
	"agent_id" text NOT NULL,
	"assigned_by" text NOT NULL,
	"partner_id" integer,
	"assignment_type" "assignment_type_enum" NOT NULL,
	"is_b2c_assignment" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" varchar(100) NOT NULL,
	"name" varchar(255),
	"project_type" "project_type_enum" NOT NULL,
	"project_stage" "project_stage_enum" DEFAULT 'registration' NOT NULL,
	"project_status" "project_status_enum" DEFAULT 'draft' NOT NULL,
	"region" varchar(100) NOT NULL,
	"country" varchar(100) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"currency_id" integer NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "project_owner_enrollment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"project_owner_id" uuid NOT NULL,
	"joined_date" date NOT NULL,
	"participation_status" "project_participation_status_enum" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_plot" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"plot_id" uuid NOT NULL,
	"enrolled_area_hectares" numeric(10, 2) NOT NULL,
	"status" "project_plot_status_enum" DEFAULT 'enrolled' NOT NULL,
	"enrolled_date" date NOT NULL,
	"removed_date" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_activity" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"activity_date" date NOT NULL,
	"activity_description" text,
	"activity_status" "project_activity_status_enum" DEFAULT 'planned' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mrv_ingestion_event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"cc_ingestion_id" varchar(100) NOT NULL,
	"project_id" uuid NOT NULL,
	"plot_id" uuid NOT NULL,
	"project_owner_id" uuid NOT NULL,
	"partner_id" integer NOT NULL,
	"device_id" varchar(100),
	"submission_timestamp" timestamp with time zone,
	"ingestion_status" "mrv_ingestion_status_enum" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mrv_ingestion_event_cc_ingestion_id_unique" UNIQUE("cc_ingestion_id")
);
--> statement-breakpoint
CREATE TABLE "mrv_verification_result" (
	"id" uuid PRIMARY KEY NOT NULL,
	"ingestion_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"verification_event_id" varchar(200) NOT NULL,
	"methodology_applied" varchar(100),
	"verification_status" "verification_status_enum" NOT NULL,
	"ai_model_id" varchar(100),
	"ai_confidence_score" numeric(5, 4),
	"is_anomalous" boolean DEFAULT false NOT NULL,
	"prediction_class" varchar(100),
	"geo_fence_status" "geo_fence_status_enum" NOT NULL,
	"hardware_integrity" varchar(50) NOT NULL,
	"gross_removals_tco2e" numeric(12, 6),
	"leakage_deduction" numeric(12, 6),
	"buffer_contribution" numeric(12, 6),
	"net_credits_issued" numeric(12, 6),
	"received_at" timestamp with time zone,
	CONSTRAINT "mrv_verification_result_verification_event_id_unique" UNIQUE("verification_event_id")
);
--> statement-breakpoint
CREATE TABLE "mrv_blockchain_anchor" (
	"id" uuid PRIMARY KEY NOT NULL,
	"result_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"network" varchar(100) NOT NULL,
	"contract_address" varchar(100) NOT NULL,
	"transaction_hash" varchar(255) NOT NULL,
	"block_height" bigint,
	"batch_id" varchar(100) NOT NULL,
	"vintage" smallint NOT NULL,
	"merkle_root" varchar(255) NOT NULL,
	"audit_uri" varchar(500) NOT NULL,
	"anchored_at" timestamp with time zone,
	CONSTRAINT "mrv_blockchain_anchor_result_id_unique" UNIQUE("result_id"),
	CONSTRAINT "mrv_blockchain_anchor_transaction_hash_unique" UNIQUE("transaction_hash"),
	CONSTRAINT "mrv_blockchain_anchor_batch_id_unique" UNIQUE("batch_id")
);
--> statement-breakpoint
CREATE TABLE "carbon_credit" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"serial_number_start" varchar(100) NOT NULL,
	"serial_number_end" varchar(100) NOT NULL,
	"total_amount" numeric(12, 6) NOT NULL,
	"available_amount" numeric(12, 6) NOT NULL,
	"credit_vintage" smallint NOT NULL,
	"credit_status" "credit_status_enum" DEFAULT 'available' NOT NULL,
	"mrv_batch_id" varchar(100) NOT NULL,
	"blockchain_tx_hash" varchar(255) NOT NULL,
	"current_owner_id" text NOT NULL,
	"registry" varchar(100),
	"generation_date" date,
	"verification_date" date,
	"issuance_date" date,
	"transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_transaction" (
	"id" uuid PRIMARY KEY NOT NULL,
	"transaction_ref" varchar(100) NOT NULL,
	"buyer_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"is_internal_sale" boolean DEFAULT false NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"price_per_credit" numeric(10, 2) NOT NULL,
	"total_amount" numeric(15, 2) NOT NULL,
	"currency_id" integer NOT NULL,
	"transaction_status" "transaction_status_enum" DEFAULT 'pending' NOT NULL,
	"transaction_date" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_transaction_transaction_ref_unique" UNIQUE("transaction_ref")
);
--> statement-breakpoint
CREATE TABLE "credit_verification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"verifier_partner_id" integer NOT NULL,
	"verification_event_id" varchar(200) NOT NULL,
	"methodology_applied" varchar(100),
	"verification_date" date NOT NULL,
	"verification_status" "verification_status_enum" NOT NULL,
	"verification_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_verification_verification_event_id_unique" UNIQUE("verification_event_id")
);
--> statement-breakpoint
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_permission_id_permission_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner" ADD CONSTRAINT "partner_default_currency_id_currency_id_fk" FOREIGN KEY ("default_currency_id") REFERENCES "public"."currency"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_owner" ADD CONSTRAINT "project_owner_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_owner" ADD CONSTRAINT "project_owner_onboarded_by_user_id_fk" FOREIGN KEY ("onboarded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_plot" ADD CONSTRAINT "farm_plot_project_owner_id_project_owner_id_fk" FOREIGN KEY ("project_owner_id") REFERENCES "public"."project_owner"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_owner_assignment" ADD CONSTRAINT "project_owner_assignment_project_owner_id_project_owner_id_fk" FOREIGN KEY ("project_owner_id") REFERENCES "public"."project_owner"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_owner_assignment" ADD CONSTRAINT "project_owner_assignment_partner_id_partner_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partner"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_currency_id_currency_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currency"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_owner_enrollment" ADD CONSTRAINT "project_owner_enrollment_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_owner_enrollment" ADD CONSTRAINT "project_owner_enrollment_project_owner_id_project_owner_id_fk" FOREIGN KEY ("project_owner_id") REFERENCES "public"."project_owner"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_plot" ADD CONSTRAINT "project_plot_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_plot" ADD CONSTRAINT "project_plot_plot_id_farm_plot_id_fk" FOREIGN KEY ("plot_id") REFERENCES "public"."farm_plot"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_activity" ADD CONSTRAINT "project_activity_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mrv_ingestion_event" ADD CONSTRAINT "mrv_ingestion_event_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mrv_ingestion_event" ADD CONSTRAINT "mrv_ingestion_event_plot_id_farm_plot_id_fk" FOREIGN KEY ("plot_id") REFERENCES "public"."farm_plot"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mrv_ingestion_event" ADD CONSTRAINT "mrv_ingestion_event_project_owner_id_project_owner_id_fk" FOREIGN KEY ("project_owner_id") REFERENCES "public"."project_owner"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mrv_ingestion_event" ADD CONSTRAINT "mrv_ingestion_event_partner_id_partner_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partner"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mrv_verification_result" ADD CONSTRAINT "mrv_verification_result_ingestion_id_mrv_ingestion_event_id_fk" FOREIGN KEY ("ingestion_id") REFERENCES "public"."mrv_ingestion_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mrv_verification_result" ADD CONSTRAINT "mrv_verification_result_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mrv_blockchain_anchor" ADD CONSTRAINT "mrv_blockchain_anchor_result_id_mrv_verification_result_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."mrv_verification_result"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mrv_blockchain_anchor" ADD CONSTRAINT "mrv_blockchain_anchor_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carbon_credit" ADD CONSTRAINT "carbon_credit_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carbon_credit" ADD CONSTRAINT "carbon_credit_mrv_batch_id_mrv_blockchain_anchor_batch_id_fk" FOREIGN KEY ("mrv_batch_id") REFERENCES "public"."mrv_blockchain_anchor"("batch_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carbon_credit" ADD CONSTRAINT "carbon_credit_transaction_id_credit_transaction_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."credit_transaction"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transaction" ADD CONSTRAINT "credit_transaction_currency_id_currency_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currency"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_verification" ADD CONSTRAINT "credit_verification_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_verification" ADD CONSTRAINT "credit_verification_verifier_partner_id_partner_id_fk" FOREIGN KEY ("verifier_partner_id") REFERENCES "public"."partner"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "idx_farm_plot_farmer_id" ON "farm_plot" USING btree ("project_owner_id");--> statement-breakpoint
CREATE INDEX "idx_farm_plot_boundary" ON "farm_plot" USING gist ("boundary");--> statement-breakpoint
CREATE INDEX "idx_farm_plot_centroid" ON "farm_plot" USING gist ("centroid");--> statement-breakpoint
CREATE INDEX "idx_project_owner_assignment_project_owner_id" ON "project_owner_assignment" USING btree ("project_owner_id");--> statement-breakpoint
CREATE INDEX "idx_project_owner_assignment_agent_id" ON "project_owner_assignment" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_project_type" ON "project" USING btree ("project_type");--> statement-breakpoint
CREATE INDEX "idx_project_status" ON "project" USING btree ("project_status");--> statement-breakpoint
CREATE INDEX "idx_project_code" ON "project" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_carbon_credit_project" ON "carbon_credit" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_carbon_credit_status" ON "carbon_credit" USING btree ("credit_status");--> statement-breakpoint
CREATE INDEX "idx_carbon_credit_owner" ON "carbon_credit" USING btree ("current_owner_id");--> statement-breakpoint
CREATE INDEX "idx_carbon_credit_vintage" ON "carbon_credit" USING btree ("credit_vintage");--> statement-breakpoint
CREATE INDEX "idx_carbon_credit_batch" ON "carbon_credit" USING btree ("mrv_batch_id");--> statement-breakpoint
CREATE INDEX "idx_credit_txn_buyer" ON "credit_transaction" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "idx_credit_txn_seller" ON "credit_transaction" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_credit_txn_status" ON "credit_transaction" USING btree ("transaction_status");