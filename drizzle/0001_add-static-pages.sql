CREATE TABLE "static_pages" (
	"slug" text PRIMARY KEY NOT NULL,
	"content_html" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" integer
);
--> statement-breakpoint
ALTER TABLE "static_pages" ADD CONSTRAINT "static_pages_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;