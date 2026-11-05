CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name"),
	CONSTRAINT "categories_name_valid" CHECK ("categories"."name" ~ '[^[:space:]]' AND "categories"."name" !~ '^[[:space:]]|[[:space:]]$')
);
