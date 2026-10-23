-- CHECK constraints cannot contain subqueries. Keep array validation in a pure
-- function so null/blank items, empty arrays and duplicate labels are rejected.
-- Repeated full-text paragraphs are allowed; category/tag labels are unique.
CREATE OR REPLACE FUNCTION public.opportunity_text_array_valid(
    items TEXT[], unique_labels BOOLEAN DEFAULT FALSE
) RETURNS BOOLEAN
LANGUAGE SQL IMMUTABLE PARALLEL SAFE
AS $$
    SELECT COALESCE(
        array_ndims(items) = 1
        AND cardinality(items) > 0
        AND NOT EXISTS (
            SELECT 1 FROM unnest(items) AS item
            WHERE item IS NULL OR item !~ '[^[:space:]]'
               OR item ~ '^[[:space:]]|[[:space:]]$'
        )
        AND (NOT unique_labels OR cardinality(items) = (
            SELECT count(DISTINCT lower(item)) FROM unnest(items) AS item
        )), FALSE
    );
$$;

--> statement-breakpoint
CREATE TABLE "article_history" (
	"source_url" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"hash" text,
	"deleted" boolean DEFAULT false NOT NULL,
	CONSTRAINT "article_history_source_url_https" CHECK ("article_history"."source_url" ~ '^https://[^[:space:]]+$'),
	CONSTRAINT "article_history_title_nonempty" CHECK ("article_history"."title" ~ '[^[:space:]]'),
	CONSTRAINT "article_history_hash_valid" CHECK ("article_history"."hash" IS NULL OR "article_history"."hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "opportunities" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"full_text" text[] NOT NULL,
	"source_url" text NOT NULL,
	"website_id" text NOT NULL,
	"source_org" text NOT NULL,
	"jurisdiction" text NOT NULL,
	"start_date" timestamp with time zone,
	"submission_deadline" timestamp with time zone NOT NULL,
	"category" text[] NOT NULL,
	"tags" text[],
	"summary" text,
	"location" jsonb,
	CONSTRAINT "opportunities_source_url_unique" UNIQUE("source_url"),
	CONSTRAINT "opportunities_id_nonempty" CHECK ("opportunities"."id" ~ '[^[:space:]]'),
	CONSTRAINT "opportunities_title_nonempty" CHECK ("opportunities"."title" ~ '[^[:space:]]'),
	CONSTRAINT "opportunities_full_text_valid" CHECK (public.opportunity_text_array_valid("opportunities"."full_text")),
	CONSTRAINT "opportunities_source_url_https" CHECK ("opportunities"."source_url" ~ '^https://[^[:space:]]+$'),
	CONSTRAINT "opportunities_source_org_nonempty" CHECK ("opportunities"."source_org" ~ '[^[:space:]]'),
	CONSTRAINT "opportunities_jurisdiction_valid" CHECK ("opportunities"."jurisdiction" IN ('Commonwealth', 'Victoria')),
	CONSTRAINT "opportunities_deadline_finite" CHECK (isfinite("opportunities"."submission_deadline")),
	CONSTRAINT "opportunities_category_valid" CHECK (public.opportunity_text_array_valid("opportunities"."category", TRUE)
    AND "opportunities"."category" <@ ARRAY[
      'Biodiversity & ecosystems', 'Climate change', 'First Nations & cultural heritage',
      'Water & resources', 'Communities & environment'
    ]::TEXT[]),
	CONSTRAINT "opportunities_tags_valid" CHECK ("opportunities"."tags" IS NULL OR public.opportunity_text_array_valid("opportunities"."tags", TRUE)),
	CONSTRAINT "opportunities_summary_nonempty" CHECK ("opportunities"."summary" IS NULL OR "opportunities"."summary" ~ '[^[:space:]]'),
	CONSTRAINT "opportunities_location_valid" CHECK ("opportunities"."location" IS NULL OR (
    jsonb_typeof("opportunities"."location") = 'object'
    AND jsonb_typeof("opportunities"."location" -> 'label') = 'string'
    AND ("opportunities"."location" ->> 'label') ~ '[^[:space:]]'
    AND jsonb_typeof("opportunities"."location" -> 'geometry') = 'object'
    AND "opportunities"."location" -> 'geometry' ->> 'type' IN ('Point', 'Polygon', 'MultiPolygon')
    AND jsonb_typeof("opportunities"."location" -> 'geometry' -> 'coordinates') = 'array'
  ) IS TRUE),
	CONSTRAINT "opportunities_date_order" CHECK ("opportunities"."start_date" IS NULL OR (isfinite("opportunities"."start_date") AND "opportunities"."start_date" <= "opportunities"."submission_deadline"))
);
--> statement-breakpoint
CREATE TABLE "websites" (
	"id" text PRIMARY KEY NOT NULL,
	"tags" text[] NOT NULL,
	CONSTRAINT "websites_id_nonempty" CHECK ("websites"."id" ~ '[^[:space:]]'),
	CONSTRAINT "websites_tags_valid" CHECK (cardinality("websites"."tags") = 0 OR public.opportunity_text_array_valid("websites"."tags", TRUE))
);
--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
-- Lock the persistent identity even when a direct insert has no history yet.
-- Scraper writes already hold this lock when committing their successful hash.
-- A deleted marker is never cleared by an opportunity insert/update.
CREATE OR REPLACE FUNCTION public.guard_deleted_opportunity()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    was_deleted BOOLEAN;
BEGIN
    INSERT INTO public.article_history (source_url, title)
    VALUES (NEW.source_url, NEW.title)
    ON CONFLICT (source_url) DO NOTHING;

    SELECT deleted INTO was_deleted FROM public.article_history
    WHERE source_url = NEW.source_url FOR UPDATE;
    IF was_deleted THEN
        RAISE EXCEPTION 'A deleted article cannot be recreated'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.remember_deleted_opportunity()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO public.article_history (source_url, title, hash, deleted)
    VALUES (OLD.source_url, OLD.title, NULL, TRUE)
    ON CONFLICT (source_url) DO UPDATE SET
        title = EXCLUDED.title,
        deleted = TRUE;
    -- Do not overwrite the last successful hash or remove this history row.
    RETURN OLD;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER opportunities_guard_deleted
BEFORE INSERT OR UPDATE ON public.opportunities
FOR EACH ROW EXECUTE FUNCTION public.guard_deleted_opportunity();
--> statement-breakpoint

CREATE TRIGGER opportunities_remember_deleted
AFTER DELETE ON public.opportunities
FOR EACH ROW EXECUTE FUNCTION public.remember_deleted_opportunity();
--> statement-breakpoint
