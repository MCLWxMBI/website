import type { Opportunity } from '~/types/opportunity'

export const opportunityAccessValues = ['public', 'invite-only'] as const
export type OpportunityAccess = typeof opportunityAccessValues[number]

export const defaultOpportunityAccess: OpportunityAccess[] = [...opportunityAccessValues]

export function getOpportunityAccess(opportunity: Pick<Opportunity, 'tags'>): OpportunityAccess {
  return opportunity.tags?.some(tag => tag.trim().toLocaleLowerCase() === 'invite-only')
    ? 'invite-only'
    : 'public'
}

export function parseOpportunityAccess(value: string): OpportunityAccess[] {
  if (value === 'public') return ['public']
  if (value === 'invite-only') return ['invite-only']
  if (value === 'none') return []
  return [...defaultOpportunityAccess]
}

export function serializeOpportunityAccess(selected: readonly OpportunityAccess[]): string | undefined {
  const includesPublic = selected.includes('public')
  const includesInviteOnly = selected.includes('invite-only')
  if (includesPublic && includesInviteOnly) return undefined
  if (includesPublic) return 'public'
  if (includesInviteOnly) return 'invite-only'
  return 'none'
}

export function matchesOpportunityAccess(
  opportunity: Pick<Opportunity, 'tags'>,
  selected: readonly OpportunityAccess[]
): boolean {
  return selected.includes(getOpportunityAccess(opportunity))
}

export function hasValidOpportunityTags(tags: readonly string[] | null): boolean {
  if (tags === null) return true
  const normalized = tags.map(tag => tag.trim().toLocaleLowerCase())
  return tags.every((tag, index) => Boolean(normalized[index]) && tag === tag.trim())
    && new Set(normalized).size === normalized.length
}

export function matchesOpportunitySearch(
  opportunity: Pick<Opportunity, 'title' | 'summary' | 'sourceOrg' | 'jurisdiction' | 'category' | 'tags'>,
  search: string
): boolean {
  const term = search.trim().toLocaleLowerCase()
  if (!term) return true
  const text = [
    opportunity.title,
    opportunity.summary,
    opportunity.sourceOrg,
    opportunity.jurisdiction,
    ...opportunity.category,
    ...(opportunity.tags ?? [])
  ].join(' ').toLocaleLowerCase()
  return text.includes(term)
}

export function getOpportunityTagGroups(
  opportunity: Pick<Opportunity, 'category' | 'tags'>,
  categoryLimit?: number
): { categories: Opportunity['category']; tags: string[] } {
  return {
    categories: categoryLimit === undefined
      ? opportunity.category
      : opportunity.category.slice(0, categoryLimit),
    tags: opportunity.tags ?? []
  }
}
