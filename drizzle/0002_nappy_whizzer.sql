ALTER TABLE "user" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ALTER COLUMN "project_tags" SET DATA TYPE jsonb USING array_to_json(project_tags)::jsonb;--> statement-breakpoint
ALTER TABLE "project" ALTER COLUMN "project_tags" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "sdgs" text[] DEFAULT '{}';--> statement-breakpoint
CREATE INDEX "idx_project_created_by" ON "project" USING btree ("created_by");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_username_unique" UNIQUE("username");