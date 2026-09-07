import { vi } from 'vitest'
export { defineEventHandler, getCookie, getHeader, createError } from 'h3'
export const getUserSession = vi.fn()
export const replaceUserSession = vi.fn()
export const clearUserSession = vi.fn()
export const useRuntimeConfig = vi.fn()
export const getRouteRules = vi.fn(() => ({}))
