# ECHO administrator authentication

All authentication responses are private/no-store. Write requests require the
`nuxt-csurf` cookie and matching `csrf-token` header (sent by `$csrfFetch`).
POST, PUT, PATCH, and DELETE are protected; invalid CSRF requests return 403.

- `POST /api/admin/login` accepts `{ username: string, password: string }`.
  Username is trimmed/lowercased; passwords are preserved exactly. Enabled admin
  accounts receive a replaced session with a 86,400-second cookie lifetime.
- `GET /api/admin/session` verifies the session’s absolute expiry and current
  account eligibility. Both endpoints return
  `{ user: { id: number, username: string, role: 'admin' }, expiresAt: number }`.
  `expiresAt` is Unix time in milliseconds, exactly 24 hours after login; ordinary
  requests never extend it. No password hash is returned or stored in the session.
- `DELETE /api/_auth/session` clears the session and returns
  `{ loggedOut: true }`. Clients refresh local session state after success.

Malformed login payloads return 400; invalid credentials and ineligible accounts
share a generic 401 response. Missing, expired, deleted-account, disabled-account,
or demoted-account sessions return 401. Database/verification failures return 503
without connection details. Future admin APIs must use the server authorization
helper, not rely on frontend route middleware.
