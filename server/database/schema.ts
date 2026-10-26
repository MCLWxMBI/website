import { sql } from 'drizzle-orm'
import {
  bigserial,
  boolean,
  check,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar
} from 'drizzle-orm/pg-core'
import type { DeadlinePrecision, Jurisdiction, OpportunityCategory, OpportunityLocation } from '../../shared/types/opportunity'

export const userRole = pgEnum('user_role', ['user', 'admin'])

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: userRole('role').notNull().default('user'),
  disabled: boolean('disabled').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

export const staticPages = pgTable('static_pages', {
  slug: text('slug').primaryKey(),
  contentHtml: text('content_html').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: integer('updated_by').references(() => users.id, { onDelete: 'set null' })
})

export const websiteIndexes = pgTable('website_indexes', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  indexUrl: text('index_url').notNull(),
  active: boolean('active').notNull().default(true),
  notes: text('notes')
})

export const websites = pgTable('websites', {
  id: text('id').primaryKey(),
  tags: text('tags').array().notNull()
}, table => [
  check('websites_id_nonempty', sql`${table.id} ~ '[^[:space:]]'`),
  check('websites_tags_valid', sql`cardinality(${table.tags}) = 0 OR public.opportunity_text_array_valid(${table.tags}, TRUE)`)
])

export const opportunities = pgTable('opportunities', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  fullText: text('full_text').array().notNull(),
  sourceUrl: text('source_url').notNull().unique(),
  websiteId: text('website_id').notNull().references(() => websites.id, { onDelete: 'restrict' }),
  sourceOrg: text('source_org').notNull(),
  jurisdiction: text('jurisdiction').$type<Jurisdiction>().notNull(),
  startDate: timestamp('start_date', { withTimezone: true }),
  submissionDeadline: timestamp('submission_deadline', { withTimezone: true }).notNull(),
  submissionDeadlinePrecision: text('submission_deadline_precision').$type<DeadlinePrecision>().notNull().default('datetime'),
  category: text('category').array().$type<OpportunityCategory[]>().notNull(),
  tags: text('tags').array(),
  summary: text('summary'),
  location: jsonb('location').$type<OpportunityLocation>()
}, table => [
  check('opportunities_id_nonempty', sql`${table.id} ~ '[^[:space:]]'`),
  check('opportunities_title_nonempty', sql`${table.title} ~ '[^[:space:]]'`),
  check('opportunities_full_text_valid', sql`public.opportunity_text_array_valid(${table.fullText})`),
  check('opportunities_source_url_https', sql`${table.sourceUrl} ~ '^https://[^[:space:]]+$'`),
  check('opportunities_source_org_nonempty', sql`${table.sourceOrg} ~ '[^[:space:]]'`),
  check('opportunities_jurisdiction_valid', sql`${table.jurisdiction} IN ('Commonwealth', 'Victoria')`),
  check('opportunities_deadline_finite', sql`isfinite(${table.submissionDeadline})`),
  check('opportunities_deadline_precision_valid', sql`${table.submissionDeadlinePrecision} IN ('datetime', 'month')`),
  check('opportunities_deadline_month_normalized', sql`${table.submissionDeadlinePrecision} <> 'month' OR (
    ${table.submissionDeadline} AT TIME ZONE 'UTC' = date_trunc('month', ${table.submissionDeadline} AT TIME ZONE 'UTC')
    AND EXTRACT(YEAR FROM ${table.submissionDeadline} AT TIME ZONE 'UTC') BETWEEN 1 AND 9999
  )`),
  check('opportunities_category_valid', sql`public.opportunity_text_array_valid(${table.category}, TRUE)
    AND ${table.category} <@ ARRAY[
      'Biodiversity & ecosystems', 'Climate change', 'First Nations & cultural heritage',
      'Water & resources', 'Communities & environment'
    ]::TEXT[]`),
  check('opportunities_tags_valid', sql`${table.tags} IS NULL OR public.opportunity_text_array_valid(${table.tags}, TRUE)`),
  check('opportunities_summary_nonempty', sql`${table.summary} IS NULL OR ${table.summary} ~ '[^[:space:]]'`),
  check('opportunities_location_valid', sql`${table.location} IS NULL OR (
    jsonb_typeof(${table.location}) = 'object'
    AND jsonb_typeof(${table.location} -> 'label') = 'string'
    AND (${table.location} ->> 'label') ~ '[^[:space:]]'
    AND jsonb_typeof(${table.location} -> 'geometry') = 'object'
    AND ${table.location} -> 'geometry' ->> 'type' IN ('Point', 'Polygon', 'MultiPolygon')
    AND jsonb_typeof(${table.location} -> 'geometry' -> 'coordinates') = 'array'
  ) IS TRUE`),
  check('opportunities_date_order', sql`${table.startDate} IS NULL OR (isfinite(${table.startDate}) AND ${table.startDate} <= ${table.submissionDeadline})`)
])

// Deliberately independent of opportunities: history survives physical deletion.
export const articleHistory = pgTable('article_history', {
  sourceUrl: text('source_url').primaryKey(),
  title: text('title').notNull(),
  hash: text('hash'),
  uploadDate: date('upload_date', { mode: 'string' }).default(sql`(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date`),
  deleted: boolean('deleted').notNull().default(false)
}, table => [
  check('article_history_source_url_https', sql`${table.sourceUrl} ~ '^https://[^[:space:]]+$'`),
  check('article_history_title_nonempty', sql`${table.title} ~ '[^[:space:]]'`),
  check('article_history_upload_date_finite', sql`${table.uploadDate} IS NULL OR isfinite(${table.uploadDate})`),
  check('article_history_hash_valid', sql`${table.hash} IS NULL OR ${table.hash} ~ '^[0-9a-f]{64}$'`)
])

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type StaticPage = typeof staticPages.$inferSelect
export type NewStaticPage = typeof staticPages.$inferInsert
export type WebsiteIndex = typeof websiteIndexes.$inferSelect
export type NewWebsiteIndex = typeof websiteIndexes.$inferInsert
export type Website = typeof websites.$inferSelect
export type NewWebsite = typeof websites.$inferInsert
export type OpportunityRecord = typeof opportunities.$inferSelect
export type NewOpportunity = typeof opportunities.$inferInsert
export type ArticleHistory = typeof articleHistory.$inferSelect
export type NewArticleHistory = typeof articleHistory.$inferInsert
