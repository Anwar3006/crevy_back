CREATE TYPE "public"."sector_enum" AS ENUM('green_economy', 'brown_economy', 'blue_economy');--> statement-breakpoint
CREATE TYPE "public"."document_type_enum" AS ENUM('land_ownership', 'community_consent', 'site_access_authorization', 'national_id', 'site_photos');--> statement-breakpoint
CREATE TYPE "public"."payout_method_enum" AS ENUM('mobile_money', 'bank_transfer', 'cash');--> statement-breakpoint
CREATE TYPE "public"."payout_status_enum" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."record_type_enum" AS ENUM('platform_fee', 'refund', 'contract_payment', 'commission', 'correction');--> statement-breakpoint
CREATE TYPE "public"."contract_status_enum" AS ENUM('draft', 'active', 'inactive', 'completed', 'terminated', 'on_hold');--> statement-breakpoint
CREATE TYPE "public"."contract_type_enum" AS ENUM('project_of_ftake', 'farmer_of_ftake', 'spot_purchase', 'credit_forward', 'escrow_agreement', 'interim_agreement');--> statement-breakpoint
CREATE TABLE "project_document" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"document_type" "document_type_enum" NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_url" varchar(500) NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" varchar(100),
	"uploaded_by" text NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"verified_by" text,
	"verified_at" timestamp with time zone,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payout" (
	"id" uuid PRIMARY KEY NOT NULL,
	"payment_ref" varchar(100) NOT NULL,
	"project_owner_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"transaction_id" uuid NOT NULL,
	"payout_amount" numeric(12, 2) NOT NULL,
	"currency_id" integer NOT NULL,
	"payout_date" date NOT NULL,
	"payout_method" "payout_method_enum" NOT NULL,
	"payout_status" "payout_status_enum" DEFAULT 'pending' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payout_payment_ref_unique" UNIQUE("payment_ref")
);
--> statement-breakpoint
CREATE TABLE "financial_record" (
	"id" uuid PRIMARY KEY NOT NULL,
	"transaction_id" uuid NOT NULL,
	"record_type" "record_type_enum" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency_id" integer NOT NULL,
	"date" date NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract" (
	"id" uuid PRIMARY KEY NOT NULL,
	"partner_id" integer NOT NULL,
	"project_id" uuid NOT NULL,
	"farmer_id" uuid NOT NULL,
	"plot_id" uuid NOT NULL,
	"contract_ref" varchar(100) NOT NULL,
	"contract_type" "contract_type_enum" NOT NULL,
	"contract_terms" text,
	"start_date" date NOT NULL,
	"end_date" date,
	"status" "contract_status_enum" DEFAULT 'draft' NOT NULL,
	"committed_credits" numeric(12, 2),
	"carbon_estimated" numeric(12, 2),
	"methodology" varchar(100),
	"payment_terms" jsonb,
	"has_data_sharing_agreement" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project" ALTER COLUMN "project_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."project_type_enum";--> statement-breakpoint
CREATE TYPE "public"."project_type_enum" AS ENUM('regenerative_agriculture', 'renewable_energy', 'waste_management', 'water_projects', 'blue_carbon');--> statement-breakpoint
ALTER TABLE "project" ALTER COLUMN "project_type" SET DATA TYPE "public"."project_type_enum" USING "project_type"::"public"."project_type_enum";--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "sector" "sector_enum" DEFAULT 'green_economy' NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "project_tags" jsonb[];--> statement-breakpoint
ALTER TABLE "project_document" ADD CONSTRAINT "project_document_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout" ADD CONSTRAINT "payout_project_owner_id_project_owner_id_fk" FOREIGN KEY ("project_owner_id") REFERENCES "public"."project_owner"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout" ADD CONSTRAINT "payout_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout" ADD CONSTRAINT "payout_transaction_id_credit_transaction_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."credit_transaction"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout" ADD CONSTRAINT "payout_currency_id_currency_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currency"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_record" ADD CONSTRAINT "financial_record_transaction_id_credit_transaction_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."credit_transaction"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_record" ADD CONSTRAINT "financial_record_currency_id_currency_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currency"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract" ADD CONSTRAINT "contract_partner_id_partner_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partner"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract" ADD CONSTRAINT "contract_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract" ADD CONSTRAINT "contract_farmer_id_project_owner_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."project_owner"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract" ADD CONSTRAINT "contract_plot_id_project_plot_id_fk" FOREIGN KEY ("plot_id") REFERENCES "public"."project_plot"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_project_document_project_id" ON "project_document" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_project_document_uploaded_by" ON "project_document" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "idx_project_document_project_type" ON "project_document" USING btree ("project_id","document_type");--> statement-breakpoint
CREATE INDEX "idx_project_document_unverified" ON "project_document" USING btree ("is_verified") WHERE is_verified = false;--> statement-breakpoint
CREATE INDEX "idx_payout_farmer" ON "payout" USING btree ("project_owner_id");--> statement-breakpoint
CREATE INDEX "idx_payout_project" ON "payout" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_payout_status" ON "payout" USING btree ("payout_status");--> statement-breakpoint
CREATE INDEX "idx_financial_record_transaction" ON "financial_record" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "idx_financial_record_type" ON "financial_record" USING btree ("record_type");--> statement-breakpoint
CREATE INDEX "idx_financial_record_date" ON "financial_record" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_contract_ref" ON "contract" USING btree ("contract_ref");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_contract_ref_project" ON "contract" USING btree ("contract_ref","project_id");--> statement-breakpoint
CREATE INDEX "idx_contract_type" ON "contract" USING btree ("contract_type");--> statement-breakpoint
CREATE INDEX "idx_contract_status" ON "contract" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_contract_methodology" ON "contract" USING btree ("methodology");