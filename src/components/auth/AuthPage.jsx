import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'

export default function AuthPage() {
  const { signIn, createAccount } = useAuth()
  const [passphrase, setPassphrase] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // Set when no account exists for the typed passphrase. Creating a log is now
  // an explicit, confirmed choice — previously a typo silently made a new empty
  // account, which looks exactly like losing all your history.
  const [confirmNew, setConfirmNew] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    const pass = passphrase.trim()
    if (!pass) return
    setLoading(true)
    setError('')
    const { error: err, needsConfirm } = await signIn(pass)
    if (err) setError(err.message)
    else if (needsConfirm) setConfirmNew(true)
    setLoading(false)
  }

  async function handleCreate() {
    setLoading(true)
    setError('')
    const { error: err } = await createAccount(passphrase.trim())
    if (err) setError(err.message)
    setLoading(false)
  }

  function handleBack() {
    setConfirmNew(false)
    setError('')
    setPassphrase('')
  }

  // <main> so the signed-out screen has a landmark; Lighthouse flagged its
  // absence here (Layout already provides one for the signed-in app).
  return (
    <main className="flex flex-col items-center justify-center min-h-dvh bg-surface px-5">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8" aria-hidden="true">
              <path d="M6 4v16M18 4v16M2 9h4M18 9h4M2 15h4M18 15h4M6 12h12" />
            </svg>
          </div>
          <h1 className="font-condensed font-bold text-white uppercase tracking-wide" style={{ fontSize: '3rem', lineHeight: 1 }}>Lift Log</h1>
          <p className="text-zinc-500 mt-2 text-sm">Track every rep. Own your progress.</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6">
          {confirmNew ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-amber-400 text-lg leading-none mt-0.5" aria-hidden="true">⚠</span>
                <div>
                  <h2 className="text-white font-condensed font-bold uppercase tracking-wide text-lg leading-tight">
                    No log found
                  </h2>
                  <p className="text-zinc-400 text-sm mt-2">
                    Nothing is stored under that passphrase. If you already have a log,
                    you may have mistyped it — check it and try again.
                  </p>
                  <p className="text-zinc-500 text-xs mt-2">
                    There is no password reset, so a new log starts empty and your old
                    one stays under its original passphrase.
                  </p>
                </div>
              </div>

              {error && <p className="text-red-400 text-sm" role="alert">{error}</p>}

              <button
                type="button"
                onClick={handleBack}
                className="w-full bg-accent hover:bg-accentHov disabled:opacity-40 text-white font-condensed font-bold uppercase tracking-wider py-3.5 rounded-xl transition-colors cursor-pointer"
                style={{ fontSize: '1.1rem' }}
              >
                Try again
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={loading}
                className="w-full border border-border text-zinc-400 hover:text-white hover:border-zinc-600 disabled:opacity-40 text-sm font-medium py-3 rounded-xl transition-colors cursor-pointer"
              >
                {loading ? 'Creating…' : 'Start a new log with this passphrase'}
              </button>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="passphrase" className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wider">Passphrase</label>
                  <input
                    id="passphrase"
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

                {error && <p className="text-red-400 text-sm" role="alert">{error}</p>}

                <button
                  type="submit"
                  disabled={loading || !passphrase.trim()}
                  className="w-full bg-accent hover:bg-accentHov disabled:opacity-40 text-white font-condensed font-bold uppercase tracking-wider py-3.5 rounded-xl transition-colors cursor-pointer"
                  style={{ fontSize: '1.1rem' }}
                >
                  {loading ? 'Connecting…' : 'Sync & Continue'}
                </button>
              </form>

              <p className="text-zinc-600 text-xs text-center mt-4">
                Use the same passphrase on every device.<br />No email needed — just don&apos;t forget it.
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
