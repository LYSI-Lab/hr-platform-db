ALTER TABLE "candidate_invites" ADD COLUMN "slot_date" varchar(20);--> statement-breakpoint
ALTER TABLE "candidate_invites" ADD COLUMN "slot_start_time" varchar(10);--> statement-breakpoint
ALTER TABLE "candidate_invites" ADD COLUMN "slot_end_time" varchar(10);--> statement-breakpoint
ALTER TABLE "candidate_invites" ADD COLUMN "meet_link" text;--> statement-breakpoint
ALTER TABLE "candidate_invites" ADD COLUMN "calendar_event_id" varchar(255);