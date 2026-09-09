import { defineEventHandler, setResponseHeader } from 'h3'
import { listWebsiteIndexes } from '../services/website-indexes'
import { websiteIndexRepository } from '../utils/website-index-repository'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return listWebsiteIndexes(websiteIndexRepository)
})
