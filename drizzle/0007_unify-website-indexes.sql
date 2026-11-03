-- This migration intentionally converts only empty legacy tables. The migrator
-- owns the transaction; locks prevent writers filling them after the check.
LOCK TABLE public.website_indexes, public.opportunities, public.websites IN ACCESS EXCLUSIVE MODE;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.opportunities) OR EXISTS (SELECT 1 FROM public.websites) THEN
    RAISE EXCEPTION 'Website consolidation requires empty opportunities and websites tables; no data has been changed';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "opportunities" DROP CONSTRAINT "opportunities_website_id_websites_id_fk";
--> statement-breakpoint
ALTER TABLE "opportunities" ALTER COLUMN "website_id" TYPE bigint USING "website_id"::bigint;
--> statement-breakpoint
ALTER TABLE "website_indexes" ADD COLUMN "tags" text[] DEFAULT '{}'::text[] NOT NULL;
--> statement-breakpoint
ALTER TABLE "website_indexes" ADD CONSTRAINT "website_indexes_tags_valid" CHECK (cardinality("tags") = 0 OR public.opportunity_text_array_valid("tags", TRUE));
--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_website_id_website_indexes_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."website_indexes"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "opportunities_website_id_idx" ON "opportunities" USING btree ("website_id");
--> statement-breakpoint
DROP TABLE "websites";
