// A logout succeeds independently of the provider's network. Persist only a cleanup flag, never an ID.
const cleanupKey = 'toadzip.push-cleanup-pending'
let logoutHandler: (() => Promise<void>) | null = null
export function pushCleanupPending() { try { return localStorage.getItem(cleanupKey) === '1' } catch { return false } }
export function markPushCleanup(pending: boolean) {
  try { if (pending) localStorage.setItem(cleanupKey, '1'); else localStorage.removeItem(cleanupKey) } catch { /* Server binding remains disabled. */ }
}
export function registerPushLogoutHandler(handler: () => Promise<void>) {
  logoutHandler = handler
  return () => { if (logoutHandler === handler) logoutHandler = null }
}
export async function afterNotificationLogout() {
  markPushCleanup(true)
  try { await logoutHandler?.() } catch { /* Do not report an already completed server logout as failed. */ }
}
