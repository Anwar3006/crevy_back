CREATE TYPE "public"."user_sex" AS ENUM('Male', 'Female', 'Other');--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "phone_number";