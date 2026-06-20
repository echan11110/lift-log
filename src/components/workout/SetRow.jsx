import { useState, useRef } from 'react'
import DropsetRow from './DropsetRow'

export default function SetRow({ set, onUpdate, onDelete, onAddDropset, onUpdateDropset, onDeleteDropset, readOnly }) {
  const [editing, setEditing] = useState(false)
  const [weight, setWeight] = useState(String(set.weight))
  const [reps, setReps] = useState(String(set.reps))
  const [addingDrop, setAddingDrop] = useState(false)
  const [dropWeight, setDropWeight] = useState('')
  const [dropReps, setDropReps] = useState('')
  const blurTimer = useRef(null)

  function saveEdit() {
    const w = parseFloat(weight)
    const r = parseInt(reps)
    if (!isNaN(w) && !isNaN(r) && r > 0) {
      onUpdate(set.id, { weight: w, reps: r })
    }
    setEditing(false)
  }

  async function submitDrop() {
    const w = parseFloat(dropWeight)
    const r = parseInt(dropReps)
    if (!isNaN(w) && !isNaN(r) && r > 0) {
      await onAddDropset(set.id, w, r)
      setDropWeight('')
      setDropReps('')
      setAddingDrop(false)
    }
  }

  return (
    <div className="mb-1">
      <div className="flex items-center gap-2 py-1.5">
        <span className="text-zinc-500 text-xs w-5 text-center">{set.set_number}</span>

        {editing ? (
          <>
            <input
              type="number"
              value={weight}
              onChange={e => setWeight(e.target.value)}
              onBlur={() => { blurTimer.current = setTimeout(saveEdit, 100) }}
              onFocus={() => clearTimeout(blurTimer.current)}
              autoFocus
              className="w-16 bg-surface border border-accent rounded-lg px-2 py-1 text-white text-sm text-center focus:outline-none"
            />
            <span className="text-zinc-600 text-xs">lbs ×</span>
            <input
              type="number"
              value={reps}
              onChange={e => setReps(e.target.value)}
              onBlur={() => { blurTimer.current = setTimeout(saveEdit, 100) }}
              onFocus={() => clearTimeout(blurTimer.current)}
              onKeyDown={e => e.key === 'Enter' && saveEdit()}
              className="w-12 bg-surface border border-accent rounded-lg px-2 py-1 text-white text-sm text-center focus:outline-none"
            />
            <span className="text-zinc-600 text-xs">reps</span>
          </>
        ) : (
          <>
            <span className="text-white text-sm font-medium">{set.weight} lbs</span>
            <span className="text-zinc-600 text-xs">×</span>
            <span className="text-white text-sm">{set.reps} reps</span>
          </>
        )}

        {!readOnly && (
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setAddingDrop(!addingDrop)}
              className="text-zinc-500 hover:text-zinc-300 px-2 py-1 text-xs rounded transition-colors"
              title="Add dropset"
            >
              ↓drop
            </button>
            {!editing && (
              <button onClick={() => setEditing(true)} className="text-zinc-500 hover:text-zinc-300 p-1 rounded transition-colors">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
                  <path d="M11.7 2.3a1 1 0 011.4 1.4L5 12 2 13l1-3 8.7-7.7z" />
                </svg>
              </button>
            )}
            <button onClick={() => onDelete(set.id)} className="text-zinc-600 hover:text-red-400 p-1 rounded transition-colors">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
                <line x1="4" y1="4" x2="12" y2="12" /><line x1="12" y1="4" x2="4" y2="12" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {set.dropsets?.map(drop => (
        <DropsetRow
          key={drop.id}
          drop={drop}
          onUpdate={onUpdateDropset}
          onDelete={onDeleteDropset}
          readOnly={readOnly}
        />
      ))}

      {addingDrop && !readOnly && (
        <div className="flex items-center gap-2 py-1.5 pl-6 border-l-2 border-zinc-700 ml-2 mt-1">
          <span className="text-zinc-500 text-xs">↓</span>
          <input
            type="number"
            value={dropWeight}
            onChange={e => setDropWeight(e.target.value)}
            placeholder="lbs"
            autoFocus
            className="w-14 bg-surface border border-border rounded-lg px-2 py-1 text-white text-sm text-center focus:outline-none focus:border-accent"
          />
          <span className="text-zinc-600 text-xs">×</span>
          <input
            type="number"
            value={dropReps}
            onChange={e => setDropReps(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitDrop()}
            placeholder="reps"
            className="w-12 bg-surface border border-border rounded-lg px-2 py-1 text-white text-sm text-center focus:outline-none focus:border-accent"
          />
          <button onClick={submitDrop} className="text-accent text-xs hover:text-blue-400 transition-colors px-1">Add</button>
          <button onClick={() => setAddingDrop(false)} className="text-zinc-600 text-xs hover:text-zinc-400 transition-colors">×</button>
        </div>
      )}
    </div>
  )
}
