CREATE TYPE "public"."analysis_job_status" AS ENUM('queued', 'parsing', 'analyzing', 'ranking', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."candidate_recommendation" AS ENUM('strong', 'good', 'partial', 'weak');--> statement-breakpoint
CREATE TYPE "public"."job_offer_status" AS ENUM('draft', 'open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."resume_status" AS ENUM('uploaded', 'parsing', 'parsed', 'analyzing', 'scored', 'error');--> statement-breakpoint
CREATE TABLE "job_analysis_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_offer_id" uuid NOT NULL,
	"resume_id" uuid NOT NULL,
	"analysis_run_id" uuid,
	"overall_score" integer NOT NULL,
	"skills_match_score" integer NOT NULL,
	"experience_match_score" integer NOT NULL,
	"education_match_score" integer NOT NULL,
	"matched_skills" text[] DEFAULT '{}' NOT NULL,
	"missing_skills" text[] DEFAULT '{}' NOT NULL,
	"highlights" text[] DEFAULT '{}' NOT NULL,
	"gaps" text[] DEFAULT '{}' NOT NULL,
	"reasoning" text NOT NULL,
	"recommendation" "candidate_recommendation" NOT NULL,
	"rank" integer,
	"must_haves_met" boolean DEFAULT false NOT NULL,
	"must_have_results" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "jar_job_resume_unique" UNIQUE("job_offer_id","resume_id")
);
--> statement-breakpoint
CREATE TABLE "job_analysis_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_offer_id" uuid NOT NULL,
	"resume_ids" uuid[] NOT NULL,
	"status" "analysis_job_status" DEFAULT 'queued' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"total_resumes" integer NOT NULL,
	"processed_resumes" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"error_message" text,
	"upstash_run_id" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" text,
	"title" varchar(255) NOT NULL,
	"department" varchar(100),
	"description" text NOT NULL,
	"requirements" text[] DEFAULT '{}' NOT NULL,
	"must_have_criteria" text[] DEFAULT '{}' NOT NULL,
	"hiring_manager_id" uuid,
	"status" "job_offer_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "job_resumes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_offer_id" uuid NOT NULL,
	"candidate_name" varchar(255),
	"candidate_email" varchar(255),
	"original_file_name" varchar(255) NOT NULL,
	"file_storage_url" text NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"file_size" integer NOT NULL,
	"raw_text" text,
	"parsed_data" jsonb,
	"status" "resume_status" DEFAULT 'uploaded' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- NOTE: "User" table already exists (owned by Integriverse). Not recreating.
-- FK reference to User.id is added below.
--> statement-breakpoint
ALTER TABLE "job_analysis_results" ADD CONSTRAINT "job_analysis_results_job_offer_id_job_offers_id_fk" FOREIGN KEY ("job_offer_id") REFERENCES "public"."job_offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_analysis_results" ADD CONSTRAINT "job_analysis_results_resume_id_job_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."job_resumes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_analysis_runs" ADD CONSTRAINT "job_analysis_runs_job_offer_id_job_offers_id_fk" FOREIGN KEY ("job_offer_id") REFERENCES "public"."job_offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_offers" ADD CONSTRAINT "job_offers_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_resumes" ADD CONSTRAINT "job_resumes_job_offer_id_job_offers_id_fk" FOREIGN KEY ("job_offer_id") REFERENCES "public"."job_offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "jar_job_offer_id_idx" ON "job_analysis_results" USING btree ("job_offer_id");--> statement-breakpoint
CREATE INDEX "jar_resume_id_idx" ON "job_analysis_results" USING btree ("resume_id");--> statement-breakpoint
CREATE INDEX "jar_overall_score_idx" ON "job_analysis_results" USING btree ("overall_score");--> statement-breakpoint
CREATE INDEX "jar_recommendation_idx" ON "job_analysis_results" USING btree ("recommendation");--> statement-breakpoint
CREATE INDEX "jar_rank_idx" ON "job_analysis_results" USING btree ("rank");--> statement-breakpoint
CREATE INDEX "jar_runs_job_offer_id_idx" ON "job_analysis_runs" USING btree ("job_offer_id");--> statement-breakpoint
CREATE INDEX "jar_runs_status_idx" ON "job_analysis_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "jar_runs_created_at_idx" ON "job_analysis_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "job_offers_user_id_idx" ON "job_offers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "job_offers_org_id_idx" ON "job_offers" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "job_offers_status_idx" ON "job_offers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "job_offers_created_at_idx" ON "job_offers" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "job_resumes_job_offer_id_idx" ON "job_resumes" USING btree ("job_offer_id");--> statement-breakpoint
CREATE INDEX "job_resumes_status_idx" ON "job_resumes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "job_resumes_candidate_email_idx" ON "job_resumes" USING btree ("candidate_email");