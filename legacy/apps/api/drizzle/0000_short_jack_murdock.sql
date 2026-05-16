DROP TABLE IF EXISTS "activity_logs", "chat_messages", "deck_cards", "generation_jobs", "decks", "card_images", "cards", "change_logs", "gen_jobs", "projects", "skills", "suggestions" CASCADE;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."activity_actor" CASCADE;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."activity_target" CASCADE;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."aspect_ratio" CASCADE;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."card_layout" CASCADE;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."card_role" CASCADE;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."chat_role" CASCADE;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."change_actor" CASCADE;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."change_target" CASCADE;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."deck_mode" CASCADE;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."deck_status" CASCADE;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."generation_status" CASCADE;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."gen_job_status" CASCADE;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."language" CASCADE;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."platform" CASCADE;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."project_status" CASCADE;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."suggestion_status" CASCADE;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."suggestion_type" CASCADE;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."text_layout" CASCADE;--> statement-breakpoint
CREATE TYPE "public"."activity_actor" AS ENUM('user', 'assistant', 'system');--> statement-breakpoint
CREATE TYPE "public"."activity_target" AS ENUM('deck', 'card', 'generation', 'chat');--> statement-breakpoint
CREATE TYPE "public"."aspect_ratio" AS ENUM('1:1', '4:5', '9:16');--> statement-breakpoint
CREATE TYPE "public"."card_layout" AS ENUM('cover', 'list', 'quote', 'stat', 'closer');--> statement-breakpoint
CREATE TYPE "public"."chat_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."deck_mode" AS ENUM('html', 'image');--> statement-breakpoint
CREATE TYPE "public"."deck_status" AS ENUM('draft', 'outlined', 'styled', 'generating', 'ready', 'exported');--> statement-breakpoint
CREATE TYPE "public"."generation_status" AS ENUM('queued', 'running', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."language" AS ENUM('zh-CN', 'zh-TW', 'en', 'ja');--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deck_id" uuid NOT NULL,
	"actor" "activity_actor" NOT NULL,
	"target" "activity_target" NOT NULL,
	"target_id" uuid,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deck_id" uuid NOT NULL,
	"card_id" uuid,
	"role" "chat_role" NOT NULL,
	"body" text NOT NULL,
	"actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deck_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deck_id" uuid NOT NULL,
	"index" integer NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"bullets" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"layout" "card_layout" DEFAULT 'list' NOT NULL,
	"note" text,
	"render" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"image_prompt" text,
	"image_url" text,
	"user_edited" boolean DEFAULT false NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text DEFAULT 'demo-user' NOT NULL,
	"title" text DEFAULT 'Untitled deck' NOT NULL,
	"prompt" text NOT NULL,
	"mode" "deck_mode" DEFAULT 'html' NOT NULL,
	"card_count" integer DEFAULT 7 NOT NULL,
	"aspect_ratio" "aspect_ratio" DEFAULT '4:5' NOT NULL,
	"language" "language" DEFAULT 'zh-CN' NOT NULL,
	"settings" jsonb NOT NULL,
	"status" "deck_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deck_id" uuid NOT NULL,
	"mode" "deck_mode" NOT NULL,
	"status" "generation_status" DEFAULT 'queued' NOT NULL,
	"requested" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_card_id_deck_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."deck_cards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_cards" ADD CONSTRAINT "deck_cards_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_logs_deck_created_idx" ON "activity_logs" USING btree ("deck_id","created_at");--> statement-breakpoint
CREATE INDEX "chat_messages_deck_created_idx" ON "chat_messages" USING btree ("deck_id","created_at");--> statement-breakpoint
CREATE INDEX "chat_messages_card_idx" ON "chat_messages" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "deck_cards_deck_index_idx" ON "deck_cards" USING btree ("deck_id","index");--> statement-breakpoint
CREATE INDEX "decks_user_updated_idx" ON "decks" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "decks_status_idx" ON "decks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "generation_jobs_deck_created_idx" ON "generation_jobs" USING btree ("deck_id","created_at");--> statement-breakpoint
CREATE INDEX "generation_jobs_status_idx" ON "generation_jobs" USING btree ("status");
