-- Backfill uploaded_by_user_id for resumes created before the column existed.
-- Pre-multi-tenant, the job creator was the implicit uploader, so attribute
-- historical rows to the job's owner. Idempotent: safe to re-run.

UPDATE "job_resumes" AS r
SET "uploaded_by_user_id" = j."user_id"
FROM "job_offers" AS j
WHERE r."job_offer_id" = j."id"
  AND r."uploaded_by_user_id" IS NULL;
