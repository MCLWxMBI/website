-- Preserve unknown historical upload dates rather than backfilling migration day.
ALTER TABLE "article_history" ADD COLUMN "upload_date" date;
--> statement-breakpoint
ALTER TABLE "article_history" ALTER COLUMN "upload_date" SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date;
--> statement-breakpoint
ALTER TABLE "article_history" ADD CONSTRAINT "article_history_upload_date_finite" CHECK ("article_history"."upload_date" IS NULL OR isfinite("article_history"."upload_date"));
