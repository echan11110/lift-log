import { useState } from 'react'
import { useWorkoutSession } from '../hooks/useWorkoutSession'
import { useExerciseNames } from '../hooks/useExerciseNames'
import { useSplitTemplates } from '../hooks/useSplitTemplates'
import { displayDate, todayStr, toDateStr, sessionVolume, cardioDuration, formatDuration } from '../lib/dateUtils'
import ExerciseCard from '../components/workout/ExerciseCard'
import CardioCard from '../components/workout/CardioCard'
import CardioEntryForm from '../components/workout/CardioEntryForm'
import ExerciseAutocomplete from '../components/workout/ExerciseAutocomplete'
import SplitBadge from '../components/ui/SplitBadge'
import { PageSpinner } from '../components/ui/Spinner'
import WeeklyView from './WeeklyView'
import MonthlyView from './MonthlyView'

export default function LogView() {
  const [tab, setTab] = useState('day')
  const [date, setDate] = useState(todayStr())
  const [editMode, setEditMode] = useState(false)
  const [showCardio, setShowCardio] = useState(false)
  const [cardioSaving, setCardioSaving] = useState(false)
  const [pendingSplitLabel, setPendingSplitLabel] = useState(null)

  const {
    session, exercises, loading, error,
    saveState, retrySave,
    updateSession, updateNotes,
    addExercise, updateExercise, deleteExercise,
    addSet, updateSet, deleteSet,
    addDropset, updateDropset, deleteDropset,
    addCardioExercise, deleteExercise: removeExercise,
  } = useWorkoutSession(date)

  const { search, searchCardio, refresh: refreshNames } = useExerciseNames()
  const { templates } = useSplitTemplates()

  const isToday = date === todayStr()

  function prevDay() {
    const d = new Date(date + 'T12:00:00')
    d.setDate(d.getDate() - 1)
    setDate(toDateStr(d))
    setEditMode(false)
    setShowCardio(false)
  }

  function nextDay() {
    const d = new Date(date + 'T12:00:00')
    d.setDate(d.getDate() + 1)
    const next = toDateStr(d)
    if (next <= todayStr()) {
      setDate(next)
      setEditMode(false)
      setShowCardio(false)
    }
  }

  // Determine which split days to show as buttons.
  // Prefer the user's own template; fall back to the system default.
  const userTemplate = templates.find(t => t.user_id !== null)
  const systemTemplate = templates.find(t => t.user_id === null)
  const activeTemplate = userTemplate ?? systemTemplate
  const splitDays = activeTemplate?.split_days ?? []

  const currentSplitLabel = session?.split_type ?? pendingSplitLabel ?? splitDays[0]?.label ?? null

  async function handleSplitChange(label) {
    if (session) {
      await updateSession({ split_type: label })
    } else {
      setPendingSplitLabel(label)
    }
  }

  async function handleAddExercise(name) {
    await addExercise(name, currentSplitLabel)
    refreshNames()
    setEditMode(true)
  }

  async function handleSaveCardio(name, data) {
    setCardioSaving(true)
    try {
      await addCardioExercise(name, currentSplitLabel, data)
      refreshNames()
      setShowCardio(false)
    } finally {
      setCardioSaving(false)
    }
  }

  const strengthExercises = exercises.filter(ex => ex.exercise_type !== 'cardio')
  const cardioExercises = exercises.filter(ex => ex.exercise_type === 'cardio')
  const totalVolume = sessionVolume(exercises)
  const totalCardioSec = cardioDuration(exercises)

  if (tab === 'week') return (
    <div>
      <SegControl tab={tab} setTab={setTab} />
      <WeeklyView />
    </div>
  )

  if (tab === 'month') return (
    <div>
      <SegControl tab={tab} setTab={setTab} />
      <MonthlyView />
    </div>
  )

  if (loading) return (
    <div>
      <SegControl tab={tab} setTab={setTab} />
      <PageSpinner />
    </div>
  )

  if (error) return (
    <div>
      <SegControl tab={tab} setTab={setTab} />
      <p className="text-red-400 text-sm py-6 text-center">{error}</p>
    </div>
  )

  if (showCardio) return (
    <div>
      <SegControl tab={tab} setTab={setTab} />
      <CardioEntryForm
        onSave={handleSaveCardio}
        onCancel={() => setShowCardio(false)}
        saving={cardioSaving}
      />
    </div>
  )

  return (
    <div>
      <SegControl tab={tab} setTab={setTab} />

      {/* Date header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-condensed font-bold text-white uppercase tracking-wide leading-none mb-1" style={{ fontSize: '1.75rem' }}>
            {displayDate(date)}
          </h2>
          {session && <SplitBadge split={session.split_type} />}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={prevDay}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-card border border-border text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >←</button>
          <button
            onClick={nextDay}
            disabled={isToday}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-card border border-border text-zinc-400 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
          >→</button>
        </div>
      </div>

      {/* Split day selector */}
      {splitDays.length > 0 && (
        <div className="flex gap-2 mb-5 flex-wrap">
          {splitDays.map(day => {
            const isActive = currentSplitLabel === day.label
            const ACTIVE_STYLES = {
              Push:  'border-red-500/40 bg-red-500/15 text-red-400',
              Pull:  'border-sky-500/40 bg-sky-500/15 text-sky-400',
              Legs:  'border-emerald-500/40 bg-emerald-500/15 text-emerald-400',
              Arms:  'border-amber-500/40 bg-amber-500/15 text-amber-400',
            }
            const activeStyle = ACTIVE_STYLES[day.label] ?? 'border-purple-500/40 bg-purple-500/15 text-purple-400'
            return (
              <button
                key={day.id}
                onClick={() => handleSplitChange(day.label)}
                className={`flex-1 min-w-0 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border cursor-pointer ${
                  isActive ? activeStyle : 'border-border text-zinc-600 hover:text-zinc-400 hover:border-zinc-600'
                }`}
              >
                {day.label}
              </button>
            )
          })}
        </div>
      )}

      {/* Session summary (when session exists) */}
      {session && (
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
      )}

      {saveState === 'saving' && <p className="text-xs text-zinc-500 text-right mb-2">Saving…</p>}
      {saveState === 'error' && (
        <button onClick={retrySave} className="text-xs text-red-400 text-right w-full mb-2 cursor-pointer">
          Save failed — tap to retry
        </button>
      )}

      {/* Strength exercises */}
      {strengthExercises.map(ex => (
        <ExerciseCard
          key={ex.id}
          exercise={ex}
          currentDate={date}
          readOnly={session ? !editMode : false}
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

      {/* Cardio exercises */}
      {cardioExercises.map(ex => (
        <CardioCard
          key={ex.id}
          exercise={ex}
          readOnly={session ? !editMode : false}
          onDelete={deleteExercise}
        />
      ))}

      {/* Add exercise (only when editing or no session yet) */}
      {(!session || editMode) && (
        <div className="mt-2">
          <ExerciseAutocomplete
            onAdd={handleAddExercise}
            search={search}
            searchCardio={searchCardio}
          />
        </div>
      )}

      {/* Session notes */}
      {session && (
        <div className="mt-5">
          <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Session notes</label>
          <textarea
            value={session.notes ?? ''}
            onChange={e => updateNotes(e.target.value)}
            placeholder="How did it feel? Any PRs? Notes…"
            rows={3}
            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-white placeholder-zinc-600 text-sm resize-none focus:outline-none focus:border-accent transition-colors"
          />
        </div>
      )}

      {/* Cardio prompt at the bottom */}
      <div className="flex items-center justify-between mt-5 pt-4 border-t border-border">
        <span className="text-xs text-zinc-600">
          {cardioExercises.length > 0 ? 'Add more cardio' : 'Add cardio for today'}
        </span>
        <button
          onClick={() => setShowCardio(true)}
          className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors cursor-pointer"
        >
          + Cardio
        </button>
      </div>
    </div>
  )
}

function SegControl({ tab, setTab }) {
  return (
    <div className="flex bg-card border border-border rounded-xl p-1 gap-1 mb-5">
      {['day', 'week', 'month'].map(t => (
        <button
          key={t}
          onClick={() => setTab(t)}
          className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
            tab === t
              ? 'bg-zinc-800 text-white border border-zinc-700'
              : 'text-zinc-600 hover:text-zinc-400'
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  )
}
