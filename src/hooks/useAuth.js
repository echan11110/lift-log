import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { setCachedUserId } from '../lib/session'
import { replayPending, clearPending } from '../lib/writeQueue'

const PASSPHRASE_KEY = 'lift-log-passphrase'

async function sha256hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function credentialsFromPassphrase(passphrase) {
  const hash = await sha256hex(passphrase.toLowerCase().trim())
  return {
    email: `${hash.slice(0, 24)}@lift-log.app`,
    password: `ll__${hash}`,
  }
}

function isNoSuchAccount(err) {
  return (err?.message ?? '').toLowerCase().includes('invalid login credentials')
}

export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  /**
   * Try to sign in with an existing account. Never creates one.
   *
   * Returns { error, needsConfirm }. needsConfirm means no account exists for
   * this passphrase — the caller must ask before calling createAccount().
   *
   * This split is the fix for the worst failure mode in the app: the old code
   * fell straight through to signUp() whenever sign-in failed, so one mistyped
   * character created a brand-new empty account. Because the passphrase is
   * hashed into a synthetic @lift-log.app address there is no password reset, so
   * the user just saw an empty log and concluded their history was gone.
   */
  async function signIn(passphrase) {
    const { email, password } = await credentialsFromPassphrase(passphrase)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error) {
      localStorage.setItem(PASSPHRASE_KEY, passphrase)
      replayPending()
      return { error: null, needsConfirm: false }
    }
    if (isNoSuchAccount(error)) return { error: null, needsConfirm: true }
    return { error, needsConfirm: false }
  }

  /** Explicitly create a new log. Only call after the user has confirmed. */
  async function createAccount(passphrase) {
    const { email, password } = await credentialsFromPassphrase(passphrase)
    const { error } = await supabase.auth.signUp({ email, password })
    if (!error) localStorage.setItem(PASSPHRASE_KEY, passphrase)
    return { error: error ?? null }
  }

  useEffect(() => {
    async function init() {
      // Restore existing session
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        setCachedUserId(session.user.id)
        // Anything a previous visit left unwritten can be sent now that there is
        // a session again.
        replayPending()
        setLoading(false)
        return
      }

      // Auto sign-in from the saved passphrase. Deliberately never creates an
      // account: if the stored passphrase no longer works, forget it and show the
      // sign-in screen rather than silently starting an empty log.
      const saved = localStorage.getItem(PASSPHRASE_KEY)
      if (saved) {
        const { error, needsConfirm } = await signIn(saved)
        if (error || needsConfirm) localStorage.removeItem(PASSPHRASE_KEY)
      }
      setLoading(false)
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setCachedUserId(session?.user?.id ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signOut() {
    localStorage.removeItem(PASSPHRASE_KEY)
    // Drop queued writes so they can never be replayed against another account
    // that signs in on this device.
    clearPending()
    await supabase.auth.signOut()
    setCachedUserId(null)
    setUser(null)
  }

  return { user, loading, signIn, createAccount, signOut }
}
