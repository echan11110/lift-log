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
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
              <path d="M6 4v16M18 4v16M2 9h4M18 9h4M2 15h4M18 15h4M6 12h12" />
            </svg>
          </div>
          <h1 className="font-condensed font-bold text-white uppercase tracking-wide" style={{fontSize:'3rem',lineHeight:1}}>Lift Log</h1>
          <p className="text-zinc-500 mt-2 text-sm">Track every rep. Own your progress.</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wider">Passphrase</label>
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
              className="w-full bg-accent hover:bg-accentHov disabled:opacity-40 text-white font-condensed font-bold uppercase tracking-wider py-3.5 rounded-xl transition-colors cursor-pointer"
              style={{fontSize:'1.1rem'}}
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
