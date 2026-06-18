import { useState } from 'react'
import { useWorkoutSession } from '../hooks/useWorkoutSession'
import { useExerciseNames } from '../hooks/useExerciseNames'
import { todayStr } from '../lib/dateUtils'
import ExerciseCard from '../components/workout/ExerciseCard'
import ExerciseAutocomplete from '../components/workout/ExerciseAutocomplete'
import { PageSpinner } from '../components/ui/Spinner'

const SPLITS = ['Push', 'Pull', 'Legs', 'Arms']

function formatDisplayDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

export default function LogView() {
  const [date, setDate] = useState(todayStr())
  const [pendingSplit, setPendingSplit] = useState('Push')
  const {
    session, exercises, loading, error,
    saveState, retrySave,
    updateSession, updateNotes, addExercise, updateExercise, deleteExercise,
    addSet, updateSet, deleteSet,
    addDropset, updateDropset, deleteDropset,
  } = useWorkoutSession(date)
  const { search, refresh: refreshNames } = useExerciseNames()

  async function handleSplitChange(split) {
    if (session) {
      await updateSession({ split_type: split })
    } else {
      setPendingSplit(split)
    }
  }

  async function handleAddExercise(name) {
    await addExercise(name, pendingSplit)
    refreshNames()
  }

  const currentSplit = session?.split_type ?? pendingSplit

  if (loading) return <PageSpinner />
  if (error) return <p className="text-red-400 text-sm py-6 text-center">{error}</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-condensed font-bold text-white uppercase tracking-wide leading-none" style={{fontSize:'1.75rem'}}>{formatDisplayDate(date)}</h2>
          {session && (
            <p className="text-zinc-500 text-xs mt-1">
              {exercises.length} exercise{exercises.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <input
          type="date"
          value={date}
          onChange={e => { setDate(e.target.value); setPendingSplit('Push') }}
          className="bg-card border border-border text-zinc-300 text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-accent cursor-pointer"
        />
      </div>

      <div className="flex gap-2 mb-5">
        {SPLITS.map(s => {
          const ACTIVE = {
            Push:  'border-red-500/40 bg-red-500/15 text-red-400',
            Pull:  'border-sky-500/40 bg-sky-500/15 text-sky-400',
            Legs:  'border-emerald-500/40 bg-emerald-500/15 text-emerald-400',
            Arms:  'border-amber-500/40 bg-amber-500/15 text-amber-400',
          }
          const isActive = currentSplit === s
          return (
            <button
              key={s}
              onClick={() => handleSplitChange(s)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border cursor-pointer ${
                isActive ? ACTIVE[s] : 'border-border text-zinc-600 hover:text-zinc-400 hover:border-zinc-600'
              }`}
            >
              {s}
            </button>
          )
        })}
      </div>

      {saveState === 'saving' && (
        <p className="text-xs text-zinc-500 text-right mb-2">Saving…</p>
      )}
      {saveState === 'error' && (
        <button onClick={retrySave} className="text-xs text-red-400 text-right w-full mb-2">
          Save failed — tap to retry
        </button>
      )}

      {exercises.map(ex => (
        <ExerciseCard
          key={ex.id}
          exercise={ex}
          currentDate={date}
          onDelete={deleteExercise}
          onRename={(id, name) => updateExercise(id, { name })}
          onAddSet={addSet}
          onUpdateSet={updateSet}
          onDeleteSet={deleteSet}
          onAddDropset={addDropset}
          onUpdateDropset={updateDropset}
          onDeleteDropset={deleteDropset}
        />
      ))}

      <div className="mt-4">
        <ExerciseAutocomplete onAdd={handleAddExercise} search={search} />
      </div>

      <div className="mt-5">
        <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Session notes</label>
        <textarea
          value={session?.notes ?? ''}
          onChange={e => updateNotes(e.target.value)}
          placeholder="How did it feel? Any PRs? Notes…"
          rows={3}
          className="w-full bg-card border border-border rounded-xl px-4 py-3 text-white placeholder-zinc-600 text-sm resize-none focus:outline-none focus:border-accent transition-colors"
        />
      </div>
    </div>
  )
}
