import { defineEventHandler } from 'h3'
import { requireAdmin } from '../../utils/require-admin'

export default defineEventHandler(event => requireAdmin(event))
