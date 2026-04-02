CREATE TYPE "public"."invite_type" AS ENUM('new', 'resend');--> statement-breakpoint
CREATE TABLE "candidate_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_offer_id" uuid NOT NULL,
	"analysis_result_id" uuid NOT NULL,
	"candidate_email" varchar(255) NOT NULL,
	"candidate_name" varchar(255),
	"type" "invite_type" DEFAULT 'new' NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"company_name" varchar(255),
	"interview_date" varchar(100),
	"interview_link" text,
	"status" varchar(50) DEFAULT 'sent' NOT NULL,
	"error_message" text,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "candidate_invites" ADD CONSTRAINT "candidate_invites_job_offer_id_job_offers_id_fk" FOREIGN KEY ("job_offer_id") REFERENCES "public"."job_offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_invites" ADD CONSTRAINT "candidate_invites_analysis_result_id_job_analysis_results_id_fk" FOREIGN KEY ("analysis_result_id") REFERENCES "public"."job_analysis_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ci_job_offer_id_idx" ON "candidate_invites" USING btree ("job_offer_id");--> statement-breakpoint
CREATE INDEX "ci_analysis_result_id_idx" ON "candidate_invites" USING btree ("analysis_result_id");--> statement-breakpoint
CREATE INDEX "ci_candidate_email_idx" ON "candidate_invites" USING btree ("candidate_email");