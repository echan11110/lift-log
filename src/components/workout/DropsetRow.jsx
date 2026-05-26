import { useState } from 'react'

export default function DropsetRow({ drop, onUpdate, onDelete, readOnly }) {
  const [editing, setEditing] = useState(false)
  const [weight, setWeight] = useState(String(drop.weight))
  const [reps, setReps] = useState(String(drop.reps))

  function saveEdit() {
    const w = parseFloat(weight)
    const r = parseInt(reps)
    if (!isNaN(w) && !isNaN(r) && r > 0) {
      onUpdate(drop.id, { weight: w, reps: r })
    }
    setEditing(false)
  }

  return (
    <div className="flex items-center gap-2 py-1.5 pl-6 border-l-2 border-zinc-700 ml-2">
      <span className="text-purple-400 text-xs">↓</span>

      {editing ? (
        <>
          <input
            type="number"
            value={weight}
            onChange={e => setWeight(e.target.value)}
            onBlur={saveEdit}
            autoFocus
            className="w-16 bg-surface border border-accent rounded-lg px-2 py-1 text-white text-xs text-center focus:outline-none"
          />
          <span className="text-zinc-600 text-xs">lbs ×</span>
          <input
            type="number"
            value={reps}
            onChange={e => setReps(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={e => e.key === 'Enter' && saveEdit()}
            className="w-12 bg-surface border border-accent rounded-lg px-2 py-1 text-white text-xs text-center focus:outline-none"
          />
          <span className="text-zinc-600 text-xs">reps</span>
        </>
      ) : (
        <>
          <span className="text-purple-200 text-xs">{drop.weight} lbs × {drop.reps} reps</span>
        </>
      )}

      {!readOnly && (
        <div className="ml-auto flex items-center gap-1">
          {!editing && (
            <button onClick={() => setEditing(true)} className="text-zinc-600 hover:text-zinc-400 p-1 rounded transition-colors">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3">
                <path d="M11.7 2.3a1 1 0 011.4 1.4L5 12 2 13l1-3 8.7-7.7z" />
              </svg>
            </button>
          )}
          <button onClick={() => onDelete(drop.id)} className="text-zinc-700 hover:text-red-400 p-1 rounded transition-colors">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3">
              <line x1="4" y1="4" x2="12" y2="12" /><line x1="12" y1="4" x2="4" y2="12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
