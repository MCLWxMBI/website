import { describe, expect, it } from 'vitest'
import { parseQuery, stringifyQuery } from 'vue-router'
import { makeOpportunity } from '../support/opportunity'
import {
  getOpportunityAuthorities,
  getOpportunityReturnQuery,
  matchesOpportunityAuthority,
  parseOpportunityAuthorities,
  searchOpportunityAuthorities,
  serializeOpportunityAuthorities
} from '../../app/utils/opportunity-authority'

const department = 'Department of Climate Change, Energy, the Environment and Water'
const authorities = ['Sustainability Victoria', department]
const opportunities = [
  makeOpportunity({ sourceOrg: department }),
  makeOpportunity({ id: 'second', sourceOrg: 'Sustainability Victoria' }),
  makeOpportunity({ id: 'third', sourceOrg: 'Another authority' })
]

describe('opportunity authority filter', () => {
  it('derives unique options in alphabetical order from the complete collection', () => {
    expect(getOpportunityAuthorities([
      { sourceOrg: 'Zebra Authority' }, { sourceOrg: 'Alpha Authority' }, { sourceOrg: 'Zebra Authority' }
    ])).toEqual(['Alpha Authority', 'Zebra Authority'])
    expect(getOpportunityAuthorities([])).toEqual([])
  })

  it('searches names case-insensitively without changing options or selections', () => {
    expect(searchOpportunityAuthorities(authorities, '  CLIMATE CHANGE ')).toEqual([department])
    expect(searchOpportunityAuthorities(authorities, '')).toEqual(authorities)
    expect(searchOpportunityAuthorities(authorities, 'no match')).toEqual([])
    expect(authorities).toEqual(['Sustainability Victoria', department])
  })

  it('matches any selected authority and treats no selections as unrestricted', () => {
    expect(opportunities.filter(item => matchesOpportunityAuthority(item, []))).toEqual(opportunities)
    const matches = opportunities.filter(item => matchesOpportunityAuthority(item, authorities))
    expect(matches.length).toBeGreaterThan(1)
    expect(new Set(matches.map(item => item.sourceOrg))).toEqual(new Set(authorities))
    expect(matchesOpportunityAuthority({ sourceOrg: department.toLowerCase() }, [department])).toBe(false)
  })

  it('accepts single or repeated values and ignores duplicate, null and unknown names', () => {
    expect(parseOpportunityAuthorities(department, authorities)).toEqual([department])
    expect(parseOpportunityAuthorities([department, null, 'unknown', department, authorities[0]!], authorities)).toEqual([department, authorities[0]])
    expect(parseOpportunityAuthorities(undefined, authorities)).toEqual([])
    expect(parseOpportunityAuthorities(null, authorities)).toEqual([])
  })

  it('round-trips repeated parameters with commas and omits an empty selection', () => {
    const query = stringifyQuery({ authority: serializeOpportunityAuthorities(authorities) })
    expect(query.match(/authority=/g)).toHaveLength(2)
    expect(parseOpportunityAuthorities(parseQuery(query).authority, authorities)).toEqual(authorities)
    expect(serializeOpportunityAuthorities([department, department])).toEqual([department])
    expect(stringifyQuery({ authority: serializeOpportunityAuthorities([]) })).toBe('')
  })

  it('preserves repeated selections and other filters on detail-page return links', () => {
    const query = { authority: authorities, q: 'climate', location: 'Commonwealth', page: '2', empty: null }
    const returned = getOpportunityReturnQuery(query)
    expect(returned).toEqual({ authority: authorities, q: 'climate', location: 'Commonwealth', page: '2' })
    expect(parseOpportunityAuthorities(parseQuery(stringifyQuery(returned)).authority, authorities)).toEqual(authorities)
  })
})
