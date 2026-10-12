export function validateAdminPassword(body: unknown): string | null {
  if (!body || typeof body !== 'object' || !('newPassword' in body) || !('confirmPassword' in body)
    || typeof body.newPassword !== 'string' || typeof body.confirmPassword !== 'string'
    || !body.newPassword || !body.confirmPassword) {
    return 'Enter and re-type your new password.'
  }
  if (body.newPassword !== body.confirmPassword) return 'Passwords do not match.'
  return null
}
