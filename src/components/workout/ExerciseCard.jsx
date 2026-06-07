import { useState } from 'react'
import SetRow from './SetRow'
import { useExerciseHistory } from '../../hooks/useExerciseHistory'

export default function ExerciseCard({ exercise, currentDate, onDelete, onRename, onAddSet, onUpdateSet, onDeleteSet, onAddDropset, onUpdateDropset, onDeleteDropset, readOnly }) {
  const [newWeight, setNewWeight] = useState('')
  const [newReps, setNewReps] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameVal, setNameVal] = useState(exercise.name)

  const { lastSets, daysAgo, allTimePR } = useExerciseHistory(
    readOnly ? null : exercise.name,
    currentDate
  )

  // Top set from last session — used as placeholder pre-fill
  const topSet = lastSets.length
    ? lastSets.reduce((best, s) => s.weight >= best.weight ? s : best, lastSets[0])
    : null

  function saveName() {
    const trimmed = nameVal.trim()
    if (trimmed && trimmed !== exercise.name) onRename?.(exercise.id, trimmed)
    else setNameVal(exercise.name)
    setEditingName(false)
  }

  async function handleAddSet() {
    const w = parseFloat(newWeight)
    const r = parseInt(newReps)
    if (isNaN(w) || isNaN(r) || r <= 0) return
    setSaving(true)
    try {
      await onAddSet(exercise.id, w, r)
      setNewReps('')
      setNewWeight('')
    } finally {
      setSaving(false)
    }
  }

  const lastTimeLabel = daysAgo === 1 ? '1d ago' : daysAgo != null ? `${daysAgo}d ago` : null

  return (
    <div className="bg-card border border-border rounded-2xl p-4 mb-3 animate-fade-in">
      <div className="flex items-center justify-between mb-1">
        {!readOnly && editingName ? (
          <input
            autoFocus
            value={nameVal}
            onChange={e => setNameVal(e.target.value)}
            onBlur={saveName}
            onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setNameVal(exercise.name); setEditingName(false) } }}
            className="font-condensed font-bold uppercase tracking-wide text-lg leading-none bg-transparent border-b border-accent text-white focus:outline-none flex-1 mr-2"
          />
        ) : (
          <h3
            className={`font-condensed font-bold text-white uppercase tracking-wide text-lg leading-none${!readOnly ? ' cursor-pointer hover:text-accent transition-colors' : ''}`}
            onClick={() => !readOnly && setEditingName(true)}
            title={!readOnly ? 'Tap to rename' : undefined}
          >{exercise.name}</h3>
        )}
        {!readOnly && (
          <button
            onClick={() => onDelete(exercise.id)}
            className="text-zinc-700 hover:text-red-400 p-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
              <polyline points="3 6 5 6 17 6" /><path d="M8 6V4h4v2" />
              <path d="M5 6l1 11h8l1-11" />
            </svg>
          </button>
        )}
      </div>

      {/* Last-time history strip */}
      {!readOnly && lastTimeLabel && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-zinc-500 text-xs">
            Last ({lastTimeLabel}):&nbsp;
            <span className="text-zinc-400">
              {lastSets.map(s => `${s.weight}×${s.reps}`).join(', ')}
            </span>
          </span>
          {allTimePR > 0 && (
            <span className="inline-flex items-center gap-0.5 text-amber-400 text-xs font-semibold bg-amber-400/10 border border-amber-400/20 rounded-full px-2 py-0.5">
              ★ PR {allTimePR} lbs
            </span>
          )}
        </div>
      )}

      {exercise.sets.length > 0 && (
        <div className="mb-3 space-y-0.5">
          {exercise.sets.map(set => (
            <SetRow
              key={set.id}
              set={set}
              onUpdate={onUpdateSet}
              onDelete={onDeleteSet}
              onAddDropset={onAddDropset}
              onUpdateDropset={onUpdateDropset}
              onDeleteDropset={onDeleteDropset}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}

      {!readOnly && (
        <div className="flex items-center gap-2 pt-2.5 border-t border-border/60">
          <input
            type="number"
            value={newWeight}
            onChange={e => setNewWeight(e.target.value)}
            placeholder={topSet ? String(topSet.weight) : 'lbs'}
            className="w-16 bg-surface border border-border rounded-lg px-2 py-2 text-white text-sm text-center focus:outline-none focus:border-accent transition-colors placeholder-zinc-600"
          />
          <span className="text-zinc-600 text-sm font-bold">×</span>
          <input
            type="number"
            value={newReps}
            onChange={e => setNewReps(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddSet()}
            placeholder={topSet ? String(topSet.reps) : 'reps'}
            className="w-14 bg-surface border border-border rounded-lg px-2 py-2 text-white text-sm text-center focus:outline-none focus:border-accent transition-colors placeholder-zinc-600"
          />
          <button
            onClick={handleAddSet}
            disabled={saving}
            className="ml-auto text-xs font-semibold bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 px-3 py-2 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
          >
            + Set
          </button>
        </div>
      )}
    </div>
  )
}
