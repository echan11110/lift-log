import { useState, useRef, useEffect } from 'react'
import DropsetRow from './DropsetRow'

// text-base (16px) rather than text-sm: iOS auto-zooms any input below 16px,
// which is why the viewport meta used to disable zoom entirely.
const NUM_INPUT =
  'bg-surface border rounded-lg px-2 py-2 text-white text-base text-center focus:outline-none'
// 44px minimum hit area. These were ~22px squares sitting 4px apart, one of which
// deleted data irreversibly.
const ICON_BTN = 'min-w-11 min-h-11 flex items-center justify-center rounded-lg transition-colors'

export default function SetRow({ set, onUpdate, onDelete, onAddDropset, onUpdateDropset, onDeleteDropset, readOnly }) {
  const [editing, setEditing] = useState(false)
  const [weight, setWeight] = useState(String(set.weight))
  const [reps, setReps] = useState(String(set.reps))
  const [invalid, setInvalid] = useState(false)
  const [addingDrop, setAddingDrop] = useState(false)
  const [dropWeight, setDropWeight] = useState('')
  const [dropReps, setDropReps] = useState('')
  const [dropInvalid, setDropInvalid] = useState(false)
  const blurTimer = useRef(null)
  const saveRef = useRef(null)

  // Re-sync when the row changes underneath us. useState initialisers only run on
  // mount and the row is keyed by set.id, so a refresh (or another tab) updated
  // the displayed value while the edit buffer kept the stale one — then saving
  // wrote the stale value back over the newer one.
  useEffect(() => {
    if (editing) return
    setWeight(String(set.weight))
    setReps(String(set.reps))
  }, [set.weight, set.reps, editing])

  function saveEdit() {
    const w = parseFloat(weight)
    const r = parseInt(reps, 10)
    // Weight 0 is legitimate (bodyweight); reps must be at least 1.
    if (Number.isNaN(w) || Number.isNaN(r) || r < 1) {
      // Previously this silently reverted to the old value with no feedback.
      setInvalid(true)
      return
    }
    setInvalid(false)
    onUpdate(set.id, { weight: w, reps: r })
    setEditing(false)
  }

  saveRef.current = saveEdit

  // If the row unmounts within the blur delay, commit rather than drop the edit.
  // The 100ms blur timer used to outlive the component, so blurring and then
  // immediately navigating away lost the change entirely.
  useEffect(() => () => {
    if (blurTimer.current) {
      clearTimeout(blurTimer.current)
      saveRef.current?.()
    }
  }, [])

  function scheduleBlurSave() {
    blurTimer.current = setTimeout(() => {
      blurTimer.current = null
      saveEdit()
    }, 100)
  }

  function cancelBlurSave() {
    clearTimeout(blurTimer.current)
    blurTimer.current = null
  }

  async function submitDrop() {
    const w = parseFloat(dropWeight)
    const r = parseInt(dropReps, 10)
    if (Number.isNaN(w) || Number.isNaN(r) || r < 1) {
      setDropInvalid(true)
      return
    }
    setDropInvalid(false)
    await onAddDropset(set.id, w, r)
    setDropWeight('')
    setDropReps('')
    setAddingDrop(false)
  }

  return (
    <div className="mb-1">
      <div className="flex items-center gap-2 py-1.5">
        <span className="text-zinc-500 text-xs w-5 text-center">{set.set_number}</span>

        {editing ? (
          <>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              value={weight}
              onChange={e => { setWeight(e.target.value); setInvalid(false) }}
              onBlur={scheduleBlurSave}
              onFocus={cancelBlurSave}
              autoFocus
              aria-label={`Weight for set ${set.set_number}`}
              aria-invalid={invalid || undefined}
              className={`w-20 ${NUM_INPUT} ${invalid ? 'border-red-500' : 'border-accent'}`}
            />
            <span className="text-zinc-600 text-xs">lbs ×</span>
            <input
              type="number"
              inputMode="numeric"
              value={reps}
              onChange={e => { setReps(e.target.value); setInvalid(false) }}
              onBlur={scheduleBlurSave}
              onFocus={cancelBlurSave}
              onKeyDown={e => e.key === 'Enter' && saveEdit()}
              aria-label={`Reps for set ${set.set_number}`}
              aria-invalid={invalid || undefined}
              className={`w-16 ${NUM_INPUT} ${invalid ? 'border-red-500' : 'border-accent'}`}
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
              className={`${ICON_BTN} px-2 text-zinc-500 hover:text-zinc-300 text-xs`}
              aria-label={`Add dropset to set ${set.set_number}`}
              aria-expanded={addingDrop}
            >
              ↓drop
            </button>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                aria-label={`Edit set ${set.set_number}`}
                className={`${ICON_BTN} text-zinc-500 hover:text-zinc-300`}
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4" aria-hidden="true">
                  <path d="M11.7 2.3a1 1 0 011.4 1.4L5 12 2 13l1-3 8.7-7.7z" />
                </svg>
              </button>
            )}
            {/* Gap so a mis-tap on the edit pencil can't destroy data. */}
            <span className="w-2" aria-hidden="true" />
            <button
              onClick={() => onDelete(set.id)}
              aria-label={`Delete set ${set.set_number}`}
              className={`${ICON_BTN} text-zinc-600 hover:text-red-400 hover:bg-red-500/10`}
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4" aria-hidden="true">
                <line x1="4" y1="4" x2="12" y2="12" /><line x1="12" y1="4" x2="4" y2="12" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {invalid && (
        <p className="text-red-400 text-xs pl-7 pb-1" role="alert">
          Enter a weight and at least 1 rep.
        </p>
      )}

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
        <div className="flex items-center gap-2 py-1.5 pl-6 border-l-2 border-zinc-700 ml-2 mt-1 flex-wrap">
          <span className="text-zinc-500 text-xs">↓</span>
          <input
            type="number"
            inputMode="decimal"
            step="any"
            value={dropWeight}
            onChange={e => { setDropWeight(e.target.value); setDropInvalid(false) }}
            placeholder="lbs"
            autoFocus
            aria-label="Dropset weight"
            className={`w-20 ${NUM_INPUT} ${dropInvalid ? 'border-red-500' : 'border-border focus:border-accent'}`}
          />
          <span className="text-zinc-600 text-xs">×</span>
          <input
            type="number"
            inputMode="numeric"
            value={dropReps}
            onChange={e => { setDropReps(e.target.value); setDropInvalid(false) }}
            onKeyDown={e => e.key === 'Enter' && submitDrop()}
            placeholder="reps"
            aria-label="Dropset reps"
            className={`w-16 ${NUM_INPUT} ${dropInvalid ? 'border-red-500' : 'border-border focus:border-accent'}`}
          />
          <button
            onClick={submitDrop}
            className={`${ICON_BTN} px-3 text-accent text-xs font-semibold border border-accent/20 bg-accent/10`}
          >
            Add
          </button>
          <button
            onClick={() => { setAddingDrop(false); setDropInvalid(false) }}
            aria-label="Cancel dropset"
            className={`${ICON_BTN} text-zinc-600 hover:text-zinc-400 text-xs`}
          >
            ×
          </button>
          {dropInvalid && (
            <p className="text-red-400 text-xs w-full" role="alert">
              Enter a weight and at least 1 rep.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
