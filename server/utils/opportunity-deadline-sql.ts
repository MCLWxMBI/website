import { sql } from 'drizzle-orm'
import { opportunities } from '../database/schema'

// Website query expressions only: no stored function, constraint, or default is changed.
export const effectiveSubmissionDeadline = sql<Date>`CASE
  WHEN ${opportunities.submissionDeadlinePrecision} = 'month'
    THEN (${opportunities.submissionDeadline} AT TIME ZONE 'UTC') AT TIME ZONE 'Australia/Melbourne'
  ELSE ${opportunities.submissionDeadline}
END`

// Explicit on website-owned inserts; existing database defaults and recorded dates stay intact.
export const currentMelbourneUploadDate = sql<string>`(CURRENT_TIMESTAMP AT TIME ZONE 'Australia/Melbourne')::date`
