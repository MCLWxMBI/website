import { defineEventHandler, setResponseHeader } from 'h3'
import { requireAdmin } from '../../../utils/require-admin'
import { opportunityExportRepository } from '../../../utils/opportunity-repository'
import { exportOpportunities } from '../../../services/opportunity-export'

export default defineEventHandler(async event => {
  await requireAdmin(event)
  const { buffer, filename } = await exportOpportunities(opportunityExportRepository)
  setResponseHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  setResponseHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`)
  return buffer
})
