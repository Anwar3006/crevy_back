CREATE TYPE "public"."user_type" AS ENUM('ProjectOwner', 'Company');--> statement-breakpoint
CREATE TABLE "company" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"legal_business_name" varchar(100) NOT NULL,
	"business_address" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_owner" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"project_category" varchar(255),
	"project_start_date" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" varchar(50) NOT NULL,
	"last_name" varchar(50) NOT NULL,
	"contact_number" varchar(20),
	"user_name" varchar(20) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"country_of_operation" varchar(100),
	"user_type" "user_type" NOT NULL,
	"updated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "users_userName_unique" UNIQUE("user_name"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "company" ADD CONSTRAINT "company_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_owner" ADD CONSTRAINT "project_owner_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;