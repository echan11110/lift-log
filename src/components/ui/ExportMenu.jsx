import { useEffect, useRef, useState } from 'react'
import { exportData } from '../../lib/exportData'

// Backup entry point. The passphrase cannot be reset, so being able to get the
// data out is the only real safety net against losing it.
export default function ExportMenu() {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onKey = e => { if (e.key === 'Escape') setOpen(false) }
    const onClick = e => { if (!wrapRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open])

  async function run(format) {
    setBusy(format)
    setError(null)
    setResult(null)
    try {
      const counts = await exportData(format)
      setResult(counts)
    } catch (err) {
      setError(err?.message ?? 'Export failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-3 min-h-11 rounded-lg border border-border cursor-pointer"
      >
        Export
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-card border border-border rounded-xl p-3 shadow-xl z-40">
          <p className="text-zinc-400 text-xs mb-3">
            Download every session, set, dropset and cardio entry.
          </p>

          <button
            onClick={() => run('json')}
            disabled={busy !== null}
            className="w-full text-left text-sm text-white hover:bg-cardHov disabled:opacity-40 rounded-lg px-3 min-h-11 border border-border mb-2 cursor-pointer"
          >
            {busy === 'json' ? 'Preparing…' : 'JSON (full backup)'}
          </button>
          <button
            onClick={() => run('csv')}
            disabled={busy !== null}
            className="w-full text-left text-sm text-white hover:bg-cardHov disabled:opacity-40 rounded-lg px-3 min-h-11 border border-border cursor-pointer"
          >
            {busy === 'csv' ? 'Preparing…' : 'CSV (spreadsheet)'}
          </button>

          {result && (
            <p className="text-emerald-400 text-xs mt-3" role="status">
              Saved {result.sessions} sessions · {result.exercises} exercises · {result.sets} sets
              {result.cardio > 0 && ` · ${result.cardio} cardio`}
            </p>
          )}
          {error && <p className="text-red-400 text-xs mt-3" role="alert">{error}</p>}
        </div>
      )}
    </div>
  )
}
