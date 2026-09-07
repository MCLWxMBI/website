// Do not clear local authentication when the server rejects deletion.
export async function logoutAdmin(removeSession: () => Promise<unknown>, refreshSession: () => Promise<unknown>) {
  await removeSession()
  await refreshSession()
}
