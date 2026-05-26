import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'

export default function AuthPage() {
  const { signInWithPassphrase } = useAuth()
  const [passphrase, setPassphrase] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!passphrase.trim()) return
    setLoading(true)
    setError('')
    const { error: err } = await signInWithPassphrase(passphrase.trim())
    if (err) setError(err.message)
    setLoading(false)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-surface px-5">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-4xl mb-3">🏋️</div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Lift Log</h1>
          <p className="text-zinc-500 mt-1 text-sm">Track every rep. Own your progress.</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Passphrase</label>
              <input
                type="password"
                value={passphrase}
                onChange={e => setPassphrase(e.target.value)}
                required
                autoFocus
                autoComplete="current-password"
                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-accent transition-colors"
                placeholder="your passphrase"
              />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading || !passphrase.trim()}
              className="w-full bg-accent hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {loading ? 'Connecting…' : 'Sync & Continue'}
            </button>
          </form>

          <p className="text-zinc-600 text-xs text-center mt-4">
            Use the same passphrase on every device.<br />No email needed — just don't forget it.
          </p>
        </div>
      </div>
    </div>
  )
}
