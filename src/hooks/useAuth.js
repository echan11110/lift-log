import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

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

export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      // Restore existing session
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        setLoading(false)
        return
      }

      // Auto sign-in from saved passphrase
      const saved = localStorage.getItem(PASSPHRASE_KEY)
      if (saved) {
        await signInWithPassphrase(saved)
      }
      setLoading(false)
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signInWithPassphrase(passphrase) {
    const { email, password } = await credentialsFromPassphrase(passphrase)

    // Try signing in first (existing account)
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
    if (!signInErr) {
      localStorage.setItem(PASSPHRASE_KEY, passphrase)
      return { error: null }
    }

    // Account doesn't exist yet — create it
    if (signInErr.message.toLowerCase().includes('invalid login credentials')) {
      const { error: signUpErr } = await supabase.auth.signUp({ email, password })
      if (!signUpErr) {
        localStorage.setItem(PASSPHRASE_KEY, passphrase)
      }
      return { error: signUpErr ?? null }
    }

    return { error: signInErr }
  }

  async function signOut() {
    localStorage.removeItem(PASSPHRASE_KEY)
    await supabase.auth.signOut()
    setUser(null)
  }

  return { user, loading, signInWithPassphrase, signOut }
}
