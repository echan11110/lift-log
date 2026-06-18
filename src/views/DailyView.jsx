import { useState } from 'react'
import { useWorkoutSession } from '../hooks/useWorkoutSession'
import { useExerciseNames } from '../hooks/useExerciseNames'
import { displayDate, todayStr, toDateStr, sessionVolume, cardioDuration, formatDuration } from '../lib/dateUtils'
import ExerciseCard from '../components/workout/ExerciseCard'
import CardioCard from '../components/workout/CardioCard'
import ExerciseAutocomplete from '../components/workout/ExerciseAutocomplete'
import SplitBadge from '../components/ui/SplitBadge'
import { PageSpinner } from '../components/ui/Spinner'

export default function DailyView() {
  const [date, setDate] = useState(todayStr())
  const [editMode, setEditMode] = useState(false)
  const {
    session, exercises, loading, error,
    saveState, retrySave,
    updateSession, updateExercise, addExercise, deleteExercise,
    addSet, updateSet, deleteSet,
    addDropset, updateDropset, deleteDropset,
  } = useWorkoutSession(date)
  const { search } = useExerciseNames()

  function prevDay() {
    const d = new Date(date + 'T12:00:00')
    d.setDate(d.getDate() - 1)
    setDate(toDateStr(d))
    setEditMode(false)
  }

  function nextDay() {
    const d = new Date(date + 'T12:00:00')
    d.setDate(d.getDate() + 1)
    const next = toDateStr(d)
    if (next <= todayStr()) {
      setDate(next)
      setEditMode(false)
    }
  }

  const isToday = date === todayStr()
  const totalVolume = sessionVolume(exercises)
  const totalCardioSec = cardioDuration(exercises)
  const strengthExercises = exercises.filter(ex => ex.exercise_type !== 'cardio')
  const cardioExercises = exercises.filter(ex => ex.exercise_type === 'cardio')

  if (loading) return <PageSpinner />
  if (error) return <p className="text-red-400 text-sm py-6 text-center">{error}</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <button onClick={prevDay} className="w-10 h-10 flex items-center justify-center rounded-xl bg-card border border-border text-zinc-400 hover:text-white transition-colors">
          ←
        </button>
        <div className="text-center">
          <p className="text-white font-bold">{displayDate(date)}</p>
          {session && <SplitBadge split={session.split_type} />}
        </div>
        <button
          onClick={nextDay}
          disabled={isToday}
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-card border border-border text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
        >
          →
        </button>
      </div>

      {!session ? (
        <div className="text-center py-16 text-zinc-600">
          <p className="text-4xl mb-3">🏋️</p>
          <p>No workout logged for this day.</p>
        </div>
      ) : (
        <>
          <div className="bg-card border border-border rounded-2xl p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-zinc-500 text-xs">Volume</p>
                <p className="text-white font-bold text-lg">{totalVolume.toLocaleString()} lbs</p>
              </div>
              <div className="text-center">
                <p className="text-zinc-500 text-xs">Exercises</p>
                <p className="text-white font-bold text-lg">{strengthExercises.length}</p>
              </div>
              {totalCardioSec > 0 && (
                <div className="text-center">
                  <p className="text-zinc-500 text-xs">Cardio</p>
                  <p className="text-blue-400 font-bold text-lg">{formatDuration(totalCardioSec)}</p>
                </div>
              )}
              <button
                onClick={() => setEditMode(!editMode)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  editMode ? 'border-accent text-accent' : 'border-border text-zinc-400 hover:text-white'
                }`}
              >
                {editMode ? 'Done' : 'Edit'}
              </button>
            </div>
            {session.notes && (
              <p className="text-zinc-400 text-sm mt-3 pt-3 border-t border-border">{session.notes}</p>
            )}
          </div>

          {saveState === 'saving' && (
            <p className="text-xs text-zinc-500 text-right mb-2">Saving…</p>
          )}
          {saveState === 'error' && (
            <button onClick={retrySave} className="text-xs text-red-400 text-right w-full mb-2">
              Save failed — tap to retry
            </button>
          )}

          {strengthExercises.map(ex => (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              currentDate={date}
              readOnly={!editMode}
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
          {cardioExercises.map(ex => (
            <CardioCard key={ex.id} exercise={ex} readOnly={!editMode} onDelete={deleteExercise} />
          ))}

          {editMode && (
            <div className="mt-4">
              <ExerciseAutocomplete onAdd={addExercise} search={search} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
