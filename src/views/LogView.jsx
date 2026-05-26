import { useState } from 'react'
import { useWorkoutSession } from '../hooks/useWorkoutSession'
import { useExerciseNames } from '../hooks/useExerciseNames'
import ExerciseCard from '../components/workout/ExerciseCard'
import ExerciseAutocomplete from '../components/workout/ExerciseAutocomplete'
import { PageSpinner } from '../components/ui/Spinner'

const SPLITS = ['Push', 'Pull', 'Legs', 'Arms']

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function formatDisplayDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

export default function LogView() {
  const [date, setDate] = useState(todayStr())
  const [pendingSplit, setPendingSplit] = useState('Push')
  const {
    session, exercises, loading, error,
    updateSession, addExercise, deleteExercise,
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
          <h2 className="text-white font-bold text-xl">{formatDisplayDate(date)}</h2>
          {session && (
            <p className="text-zinc-500 text-xs mt-0.5">
              {exercises.length} exercise{exercises.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <input
          type="date"
          value={date}
          onChange={e => { setDate(e.target.value); setPendingSplit('Push') }}
          className="bg-card border border-border text-zinc-300 text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-accent"
        />
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        {SPLITS.map(s => (
          <button
            key={s}
            onClick={() => handleSplitChange(s)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${
              currentSplit === s
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {exercises.map(ex => (
        <ExerciseCard
          key={ex.id}
          exercise={ex}
          onDelete={deleteExercise}
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
        <label className="block text-xs text-zinc-500 mb-1.5">Session notes</label>
        <textarea
          value={session?.notes ?? ''}
          onChange={e => session && updateSession({ notes: e.target.value })}
          placeholder="How did it feel? Any PRs? Notes…"
          rows={3}
          className="w-full bg-card border border-border rounded-xl px-4 py-3 text-white placeholder-zinc-600 text-sm resize-none focus:outline-none focus:border-accent transition-colors"
        />
      </div>
    </div>
  )
}
