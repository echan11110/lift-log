import { supabase } from './supabase'

// The app previously called supabase.auth.getUser() from several hooks, which is
// a network round trip to /auth/v1/user each time — three per cold load, plus six
// more when six exercise cards mounted. getSession() reads the persisted session
// locally, so the user id costs nothing after sign-in.

let cachedUserId = null
// Concurrent callers share one lookup rather than racing to assign the cache.
let inFlight = null

/** Kept in sync by useAuth's onAuthStateChange. */
export function setCachedUserId(id) {
  cachedUserId = id ?? null
  inFlight = null
}

export async function getUserId() {
  if (cachedUserId) return cachedUserId
  if (!inFlight) {
    inFlight = supabase.auth.getSession()
      .then(({ data: { session } }) => {
        cachedUserId = session?.user?.id ?? null
        return cachedUserId
      })
      .finally(() => { inFlight = null })
  }
  return inFlight
}
