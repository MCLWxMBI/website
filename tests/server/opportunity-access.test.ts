import { describe, expect, it } from 'vitest'
import { opportunities } from '../../app/data/opportunities'
import {
  defaultOpportunityAccess,
  getOpportunityAccess,
  getOpportunityTagGroups,
  hasValidOpportunityTags,
  matchesOpportunityAccess,
  matchesOpportunitySearch,
  parseOpportunityAccess,
  serializeOpportunityAccess
} from '../../app/utils/opportunity-access'

const inviteOnlyIds = [
  'offshore-renewables-guidance',
  'cultural-landscape-guidelines',
  'critical-minerals-review'
]

describe('opportunity categories and tags', () => {
  it('keeps controlled categories separate from valid flexible tags', () => {
    expect(opportunities.every(opportunity => opportunity.category.length > 0)).toBe(true)
    expect(opportunities.every(opportunity => hasValidOpportunityTags(opportunity.tags))).toBe(true)
    expect(opportunities.filter(opportunity => opportunity.tags?.includes('Invite-only')).map(opportunity => opportunity.id))
      .toEqual(inviteOnlyIds)
    expect(opportunities.filter(opportunity => !inviteOnlyIds.includes(opportunity.id)).every(opportunity => opportunity.tags === null)).toBe(true)
  })

  it('rejects blank, padded, and case-insensitively duplicated tag values', () => {
    expect(hasValidOpportunityTags(null)).toBe(true)
    expect(hasValidOpportunityTags(['Invite-only', 'Priority'])).toBe(true)
    expect(hasValidOpportunityTags([''])).toBe(false)
    expect(hasValidOpportunityTags([' Priority'])).toBe(false)
    expect(hasValidOpportunityTags(['Priority', 'priority'])).toBe(false)
  })

  it('searches both categories and flexible tags', () => {
    const opportunity = opportunities.find(item => item.id === 'offshore-renewables-guidance')!
    expect(matchesOpportunitySearch(opportunity, 'climate change')).toBe(true)
    expect(matchesOpportunitySearch(opportunity, 'invite-only')).toBe(true)
    expect(matchesOpportunitySearch(opportunity, 'unrelated')).toBe(false)
  })

  it('provides separate category and flexible-tag groups for catalogue views', () => {
    const opportunity = {
      ...opportunities.find(item => item.id === 'offshore-renewables-guidance')!,
      status: 'closed' as const
    }
    expect(getOpportunityTagGroups(opportunity, 1)).toEqual({
      categories: ['Climate change'],
      tags: ['Invite-only']
    })
  })
})

describe('opportunity access filter', () => {
  it('defaults to both access types and serializes every selection', () => {
    expect(defaultOpportunityAccess).toEqual(['public', 'invite-only'])
    expect(serializeOpportunityAccess(defaultOpportunityAccess)).toBeUndefined()
    expect(serializeOpportunityAccess(['public'])).toBe('public')
    expect(serializeOpportunityAccess(['invite-only'])).toBe('invite-only')
    expect(serializeOpportunityAccess([])).toBe('none')
    expect(parseOpportunityAccess('public')).toEqual(['public'])
    expect(parseOpportunityAccess('invite-only')).toEqual(['invite-only'])
    expect(parseOpportunityAccess('none')).toEqual([])
    expect(parseOpportunityAccess('invalid')).toEqual(defaultOpportunityAccess)
  })

  it('classifies and filters public and invite-only records', () => {
    const inviteOnly = opportunities.find(item => item.id === 'offshore-renewables-guidance')!
    const publicOpportunity = opportunities.find(item => item.id === 'victorian-waterway-health')!

    expect(getOpportunityAccess(inviteOnly)).toBe('invite-only')
    expect(getOpportunityAccess(publicOpportunity)).toBe('public')
    expect(matchesOpportunityAccess(inviteOnly, defaultOpportunityAccess)).toBe(true)
    expect(matchesOpportunityAccess(publicOpportunity, defaultOpportunityAccess)).toBe(true)
    expect(matchesOpportunityAccess(inviteOnly, ['public'])).toBe(false)
    expect(matchesOpportunityAccess(publicOpportunity, ['invite-only'])).toBe(false)
    expect(matchesOpportunityAccess(inviteOnly, [])).toBe(false)
  })

})
