CREATE TYPE "public"."aspect_ratio" AS ENUM('4:5', '1:1');--> statement-breakpoint
CREATE TYPE "public"."card_role" AS ENUM('cover', 'hook', 'argument', 'list', 'payoff', 'cta');--> statement-breakpoint
CREATE TYPE "public"."change_actor" AS ENUM('user', 'agent');--> statement-breakpoint
CREATE TYPE "public"."change_target" AS ENUM('card', 'project', 'image');--> statement-breakpoint
CREATE TYPE "public"."gen_job_status" AS ENUM('queued', 'running', 'partial', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."language" AS ENUM('zh', 'en');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('redbook', 'greenbook');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('draft', 'planning', 'generating', 'editing', 'exported');--> statement-breakpoint
CREATE TYPE "public"."suggestion_status" AS ENUM('pending', 'accepted', 'ignored');--> statement-breakpoint
CREATE TYPE "public"."suggestion_type" AS ENUM('structure', 'platform_sop', 'quality');--> statement-breakpoint
CREATE TYPE "public"."text_layout" AS ENUM('top', 'calligraphy', 'fullscreen', 'caption');--> statement-breakpoint
CREATE TABLE "card_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"gen_job_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"url" text NOT NULL,
	"full_prompt" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"index" integer NOT NULL,
	"role" "card_role" NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"image_version_id" uuid,
	"user_edited" boolean DEFAULT false NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "change_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"actor" "change_actor" NOT NULL,
	"target" "change_target" NOT NULL,
	"target_id" uuid NOT NULL,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gen_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"status" "gen_job_status" DEFAULT 'queued' NOT NULL,
	"main_subject" jsonb NOT NULL,
	"art_style" text DEFAULT '' NOT NULL,
	"text_layout" text_layout DEFAULT 'top' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"platform" "platform" DEFAULT 'redbook' NOT NULL,
	"topic" text NOT NULL,
	"card_count" integer DEFAULT 9 NOT NULL,
	"aspect_ratio" "aspect_ratio" DEFAULT '4:5' NOT NULL,
	"language" "language" DEFAULT 'zh' NOT NULL,
	"tone" text DEFAULT 'native' NOT NULL,
	"skill_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "project_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"author" text NOT NULL,
	"category" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"system_prompt" text NOT NULL,
	"few_shot_examples" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"image_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"output_schema" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"applies_to" jsonb NOT NULL,
	"is_official" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"card_id" uuid,
	"type" "suggestion_type" NOT NULL,
	"message" text NOT NULL,
	"action_label" text NOT NULL,
	"action_payload" jsonb NOT NULL,
	"status" "suggestion_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "card_images" ADD CONSTRAINT "card_images_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_images" ADD CONSTRAINT "card_images_gen_job_id_gen_jobs_id_fk" FOREIGN KEY ("gen_job_id") REFERENCES "public"."gen_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_logs" ADD CONSTRAINT "change_logs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gen_jobs" ADD CONSTRAINT "gen_jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "card_images_card_id_idx" ON "card_images" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "cards_project_id_index_idx" ON "cards" USING btree ("project_id","index");--> statement-breakpoint
CREATE INDEX "change_logs_project_created_idx" ON "change_logs" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "gen_jobs_project_status_idx" ON "gen_jobs" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "projects_user_id_idx" ON "projects" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "suggestions_project_status_idx" ON "suggestions" USING btree ("project_id","status");