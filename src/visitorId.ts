import { toHex } from './pendo/utils'

export async function getVisitorId(): Promise<string> {
  let data = JSON.parse(window.localStorage.getItem('visitorId') ?? '{}')
  if (data.expiry ?? 0 < Date.now()) {
    const id = toHex(await window.crypto.getRandomValues(new Uint8Array(16)))
    data = {
      id,
      // random 1-2 week timeout
      expiry: Date.now() + (1 + Math.random()) * 7 * 24 * 60 * 60 * 1000
    }
    window.localStorage.setItem('visitorId', JSON.stringify(data))
  }
  return data.id
}

export function resetVisitorId() {
  window.localStorage.removeItem('visitorId')
  // gotta reload to force agent to randomize its tab/session IDs as well
  window.location.reload()
}
