import type { Opportunity } from '~/types/opportunity'
import type { LocationQuery, LocationQueryValue } from 'vue-router'

export function getOpportunityAuthorities(opportunities: readonly Pick<Opportunity, 'sourceOrg'>[]): string[] {
  return [...new Set(opportunities.map(item => item.sourceOrg))].sort((a, b) => a.localeCompare(b, 'en-AU'))
}

export function searchOpportunityAuthorities(authorities: readonly string[], search: string): string[] {
  const term = search.trim().toLocaleLowerCase()
  return authorities.filter(authority => authority.toLocaleLowerCase().includes(term))
}

export function matchesOpportunityAuthority(opportunity: Pick<Opportunity, 'sourceOrg'>, selected: readonly string[]): boolean {
  return selected.length === 0 || selected.includes(opportunity.sourceOrg)
}

export function parseOpportunityAuthorities(
  value: LocationQueryValue | LocationQueryValue[] | undefined,
  authorities: readonly string[]
): string[] {
  const values = Array.isArray(value) ? value : [value]
  return [...new Set(values.filter((item): item is string => typeof item === 'string' && authorities.includes(item)))]
}

export function serializeOpportunityAuthorities(selected: readonly string[]): string[] | undefined {
  return selected.length ? [...new Set(selected)] : undefined
}

export function getOpportunityReturnQuery(query: LocationQuery): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {}
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'string') result[key] = value
    else if (Array.isArray(value)) result[key] = value.filter((item): item is string => typeof item === 'string')
  }
  return result
}
