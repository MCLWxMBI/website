ALTER TABLE "opportunities" ADD COLUMN "submission_deadline_precision" text DEFAULT 'datetime' NOT NULL;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_deadline_precision_valid" CHECK ("opportunities"."submission_deadline_precision" IN ('datetime', 'month'));--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_deadline_month_normalized" CHECK ("opportunities"."submission_deadline_precision" <> 'month' OR (
    "opportunities"."submission_deadline" AT TIME ZONE 'UTC' = date_trunc('month', "opportunities"."submission_deadline" AT TIME ZONE 'UTC')
    AND EXTRACT(YEAR FROM "opportunities"."submission_deadline" AT TIME ZONE 'UTC') BETWEEN 1 AND 9999
  ));