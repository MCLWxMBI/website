ALTER TABLE "article_history" ADD COLUMN "source_index_id" bigint;--> statement-breakpoint
ALTER TABLE "article_history" ADD CONSTRAINT "article_history_source_index_id_website_indexes_id_fk" FOREIGN KEY ("source_index_id") REFERENCES "public"."website_indexes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "article_history_source_recent_idx" ON "article_history" USING btree ("source_index_id","upload_date" DESC NULLS LAST,"source_url");--> statement-breakpoint
-- Backfill only an unambiguous, most-specific origin + path-prefix match.
-- Query strings/fragments and trailing slashes do not affect matching. A root
-- index intentionally covers its origin; /project never matches /projects.
-- Match HTTPS authorities case-insensitively and normalize the default port.
WITH indexes AS (
  SELECT id,
    regexp_replace(lower(parts[1]), ':443$', '') AS origin,
    rtrim(COALESCE(parts[2], ''), '/') AS path
  FROM public.website_indexes
  CROSS JOIN LATERAL regexp_match(index_url, '^(https://[^/?#@[:space:]]+)(/[^?#[:space:]]*)?([?#].*)?$') AS parts
), articles AS (
  SELECT source_url,
    regexp_replace(lower(parts[1]), ':443$', '') AS origin,
    rtrim(COALESCE(parts[2], ''), '/') AS path
  FROM public.article_history
  CROSS JOIN LATERAL regexp_match(source_url, '^(https://[^/?#@[:space:]]+)(/[^?#[:space:]]*)?([?#].*)?$') AS parts
), candidates AS (
  SELECT articles.source_url, indexes.id,
    rank() OVER (PARTITION BY articles.source_url ORDER BY length(indexes.path) DESC) AS specificity
  FROM articles JOIN indexes ON articles.origin = indexes.origin
    AND (articles.path = indexes.path OR left(articles.path, length(indexes.path) + 1) = indexes.path || '/')
), unique_matches AS (
  SELECT source_url, min(id) AS id
  FROM candidates WHERE specificity = 1
  GROUP BY source_url HAVING count(*) = 1
)
UPDATE public.article_history AS history SET source_index_id = matches.id
FROM unique_matches AS matches
WHERE history.source_url = matches.source_url AND history.source_index_id IS NULL;
