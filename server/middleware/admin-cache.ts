import { defineEventHandler, getRequestURL, setResponseHeader } from 'h3'

export default defineEventHandler((event) => {
  if (/^\/(?:admin(?:\/|$)|api\/(?:admin|_auth)(?:\/|$))/.test(getRequestURL(event).pathname)) {
    setResponseHeader(event, 'Cache-Control', 'private, no-store')
    setResponseHeader(event, 'X-Robots-Tag', 'noindex, nofollow')
  }
})
