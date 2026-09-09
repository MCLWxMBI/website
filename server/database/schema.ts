import {
  bigserial,
  boolean,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar
} from 'drizzle-orm/pg-core'

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

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type StaticPage = typeof staticPages.$inferSelect
export type NewStaticPage = typeof staticPages.$inferInsert
export type WebsiteIndex = typeof websiteIndexes.$inferSelect
export type NewWebsiteIndex = typeof websiteIndexes.$inferInsert
