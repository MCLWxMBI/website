CREATE TABLE "website_indexes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"index_url" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text
);
