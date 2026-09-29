import { useState, useEffect } from 'react'

const NUM_INPUT =
  'bg-surface border rounded-lg px-2 py-2 text-white text-base text-center focus:outline-none'
const ICON_BTN = 'min-w-11 min-h-11 flex items-center justify-center rounded-lg transition-colors'

export default function DropsetRow({ drop, onUpdate, onDelete, readOnly }) {
  const [editing, setEditing] = useState(false)
  const [weight, setWeight] = useState(String(drop.weight))
  const [reps, setReps] = useState(String(drop.reps))
  const [invalid, setInvalid] = useState(false)

  // Same stale-buffer fix as SetRow: re-sync when the row changes underneath us.
  useEffect(() => {
    if (editing) return
    setWeight(String(drop.weight))
    setReps(String(drop.reps))
  }, [drop.weight, drop.reps, editing])

  function saveEdit() {
    const w = parseFloat(weight)
    const r = parseInt(reps, 10)
    if (Number.isNaN(w) || Number.isNaN(r) || r < 1) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    onUpdate(drop.id, { weight: w, reps: r })
    setEditing(false)
  }

  return (
    <div className="pl-6 border-l-2 border-zinc-700 ml-2">
      <div className="flex items-center gap-2 py-1.5">
        <span className="text-purple-400 text-xs">↓</span>

        {editing ? (
          <>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              value={weight}
              onChange={e => { setWeight(e.target.value); setInvalid(false) }}
              onBlur={saveEdit}
              autoFocus
              aria-label="Dropset weight"
              aria-invalid={invalid || undefined}
              className={`w-20 ${NUM_INPUT} ${invalid ? 'border-red-500' : 'border-accent'}`}
            />
            <span className="text-zinc-600 text-xs">lbs ×</span>
            <input
              type="number"
              inputMode="numeric"
              value={reps}
              onChange={e => { setReps(e.target.value); setInvalid(false) }}
              onBlur={saveEdit}
              onKeyDown={e => e.key === 'Enter' && saveEdit()}
              aria-label="Dropset reps"
              aria-invalid={invalid || undefined}
              className={`w-16 ${NUM_INPUT} ${invalid ? 'border-red-500' : 'border-accent'}`}
            />
            <span className="text-zinc-600 text-xs">reps</span>
          </>
        ) : (
          <span className="text-purple-200 text-xs">{drop.weight} lbs × {drop.reps} reps</span>
        )}

        {!readOnly && (
          <div className="ml-auto flex items-center gap-1">
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                aria-label={`Edit dropset ${drop.weight} lbs by ${drop.reps} reps`}
                className={`${ICON_BTN} text-zinc-600 hover:text-zinc-400`}
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4" aria-hidden="true">
                  <path d="M11.7 2.3a1 1 0 011.4 1.4L5 12 2 13l1-3 8.7-7.7z" />
                </svg>
              </button>
            )}
            <span className="w-2" aria-hidden="true" />
            <button
              onClick={() => onDelete(drop.id)}
              aria-label={`Delete dropset ${drop.weight} lbs by ${drop.reps} reps`}
              className={`${ICON_BTN} text-zinc-700 hover:text-red-400 hover:bg-red-500/10`}
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4" aria-hidden="true">
                <line x1="4" y1="4" x2="12" y2="12" /><line x1="12" y1="4" x2="4" y2="12" />
              </svg>
            </button>
          </div>
        )}
      </div>
      {invalid && (
        <p className="text-red-400 text-xs pb-1" role="alert">
          Enter a weight and at least 1 rep.
        </p>
      )}
    </div>
  )
}
