CREATE TABLE "scraper_runs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text DEFAULT 'running' NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"extracted_opportunities" jsonb DEFAULT '[]'::jsonb NOT NULL
);
