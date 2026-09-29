import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useWorkoutSession } from '../hooks/useWorkoutSession'
import { useExerciseNames } from '../hooks/useExerciseNames'
import { useSessionHistory, EMPTY_HISTORY } from '../hooks/useExerciseHistory'
import { useCardioDefs } from '../hooks/useCardioDefs'
import { useSplitTemplates } from '../hooks/useSplitTemplates'
import { displayDate, todayStr, toDateStr, sessionVolume, cardioDuration, formatDuration } from '../lib/dateUtils'
import ExerciseCard from '../components/workout/ExerciseCard'
import CardioCard from '../components/workout/CardioCard'
import CardioEntryForm from '../components/workout/CardioEntryForm'
import ExerciseAutocomplete from '../components/workout/ExerciseAutocomplete'
import SplitBadge from '../components/ui/SplitBadge'
import CalendarPopover from '../components/ui/CalendarPopover'
import { ToastStack, Toast } from '../components/ui/Toast'
import { PageSpinner } from '../components/ui/Spinner'
import WeeklyView from './WeeklyView'
import MonthlyView from './MonthlyView'

// Hoisted: this was rebuilt for every split button on every render.
const ACTIVE_STYLES = {
  Push: 'border-red-500/40 bg-red-500/15 text-red-400',
  Pull: 'border-sky-500/40 bg-sky-500/15 text-sky-400',
  Legs: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400',
  Arms: 'border-amber-500/40 bg-amber-500/15 text-amber-400',
}
const FALLBACK_ACTIVE = 'border-purple-500/40 bg-purple-500/15 text-purple-400'

const TAB_ROUTES = { day: '/log', week: '/week', month: '/month' }
const ROUTE_TABS = { '/log': 'day', '/week': 'week', '/month': 'month' }

export default function LogView() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  // The tab lives in the URL so week/month can be bookmarked, deep-linked and
  // reached with the back button. It used to be local state behind three routes
  // that all redirected to /log.
  const tab = ROUTE_TABS[pathname] ?? 'day'

  const [date, setDate] = useState(todayStr())
  const [editMode, setEditMode] = useState(false)
  const [cardioForm, setCardioForm] = useState(null)
  const [cardioSaving, setCardioSaving] = useState(false)
  const [cardioError, setCardioError] = useState(null)
  const [pendingSplitLabel, setPendingSplitLabel] = useState(null)
  const [showCalendar, setShowCalendar] = useState(false)

  const {
    session, exercises, loading, error,
    saveState, pendingCount, failedCount, saveErrorMessage, retrySave,
    actionError, dismissActionError,
    pendingDelete, undoDelete, guard,
    updateSession, updateNotes,
    addExercise, updateExercise, deleteExercise,
    addSet, updateSet, deleteSet,
    addDropset, updateDropset, deleteDropset,
    addCardioExercise, updateCardioEntry,
  } = useWorkoutSession(date)

  const { search, searchCardio, refresh: refreshNames } = useExerciseNames()
  const { defs, addDef } = useCardioDefs()
  const { templates } = useSplitTemplates()

  const strengthExercises = useMemo(
    () => exercises.filter(ex => ex.exercise_type !== 'cardio'),
    [exercises]
  )
  const cardioExercises = useMemo(
    () => exercises.filter(ex => ex.exercise_type === 'cardio'),
    [exercises]
  )

  // One history query covering every strength exercise on screen, not one per card.
  const strengthNames = useMemo(() => strengthExercises.map(ex => ex.name), [strengthExercises])
  const historyNames = editMode || !session ? strengthNames : []
  const history = useSessionHistory(historyNames, date)

  const isToday = date === todayStr()

  function goToDate(next) {
    setDate(next)
    setEditMode(false)
    setCardioForm(null)
    setShowCalendar(false)
  }

  function prevDay() {
    const d = new Date(date + 'T12:00:00')
    d.setDate(d.getDate() - 1)
    goToDate(toDateStr(d))
  }

  function nextDay() {
    const d = new Date(date + 'T12:00:00')
    d.setDate(d.getDate() + 1)
    const next = toDateStr(d)
    if (next <= todayStr()) goToDate(next)
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
      // Previously unguarded: updateSession throws, so a failure became an
      // unhandled rejection with no feedback at all.
      await guard(() => updateSession({ split_type: label }), 'Could not change split')
    } else {
      setPendingSplitLabel(label)
    }
  }

  async function handleAddExercise(name) {
    setEditMode(true)
    const result = await guard(async () => {
      const ex = await addExercise(name, currentSplitLabel)
      await refreshNames()
      return ex
    }, 'Could not add exercise')
    if (!result) setEditMode(false)
  }

  async function handleSaveCardio(name, data) {
    setCardioSaving(true)
    setCardioError(null)
    try {
      await addCardioExercise(name, currentSplitLabel, data)
      await refreshNames()
      setCardioForm(null)
    } catch (err) {
      setCardioError(err?.message ?? 'Failed to save cardio')
    } finally {
      setCardioSaving(false)
    }
  }

  async function handleUpdateCardio(name, data) {
    setCardioSaving(true)
    setCardioError(null)
    try {
      const ex = cardioForm.exercise
      await updateCardioEntry(ex.id, data)
      if (name !== ex.name) await updateExercise(ex.id, { name })
      setCardioForm(null)
    } catch (err) {
      setCardioError(err?.message ?? 'Failed to update cardio')
    } finally {
      setCardioSaving(false)
    }
  }

  const totalVolume = sessionVolume(exercises)
  const totalCardioSec = cardioDuration(exercises)

  // Fixed above the bottom nav, so they stay visible however far down the
  // exercise list you are scrolled.
  const toasts = (
    <ToastStack>
      {pendingDelete && (
        <Toast tone="accent" action="Undo" onAction={undoDelete} role="status">
          {pendingDelete.label} deleted
        </Toast>
      )}
      {actionError && (
        <Toast tone="error" action="Dismiss" onAction={dismissActionError} role="alert">
          {actionError}
        </Toast>
      )}
      {saveState === 'error' && (
        <Toast tone="error" action="Retry" onAction={retrySave} role="alert">
          {failedCount} unsaved {failedCount === 1 ? 'change' : 'changes'}
          {saveErrorMessage ? ` — ${saveErrorMessage}` : ''}
        </Toast>
      )}
      {saveState === 'saving' && (
        <Toast role="status">Saving {pendingCount > 1 ? `${pendingCount} changes…` : '…'}</Toast>
      )}
    </ToastStack>
  )

  if (tab === 'week') return (
    <div>
      <SegControl tab={tab} navigate={navigate} />
      <WeeklyView />
      {toasts}
    </div>
  )

  if (tab === 'month') return (
    <div>
      <SegControl tab={tab} navigate={navigate} />
      <MonthlyView />
      {toasts}
    </div>
  )

  if (loading) return (
    <div>
      <SegControl tab={tab} navigate={navigate} />
      <PageSpinner />
    </div>
  )

  if (error) return (
    <div>
      <SegControl tab={tab} navigate={navigate} />
      <p className="text-red-400 text-sm py-6 text-center" role="alert">{error}</p>
      <button
        onClick={() => window.location.reload()}
        className="mx-auto block text-xs text-zinc-400 border border-border px-4 min-h-11 rounded-lg cursor-pointer"
      >
        Try again
      </button>
    </div>
  )

  if (cardioForm) {
    const isEdit = cardioForm.mode === 'edit'
    return (
      <div>
        <SegControl tab={tab} navigate={navigate} />
        <CardioEntryForm
          defs={defs}
          onSave={handleSaveCardio}
          onUpdate={handleUpdateCardio}
          onAddDef={addDef}
          onCancel={() => { setCardioForm(null); setCardioError(null) }}
          saving={cardioSaving}
          error={cardioError}
          initialActivity={!isEdit ? cardioForm.initialActivity : undefined}
          initialValues={isEdit ? { ...cardioForm.exercise.cardio_entry, name: cardioForm.exercise.name } : undefined}
        />
      </div>
    )
  }

  return (
    <div>
      <SegControl tab={tab} navigate={navigate} />

      {/* Date header */}
      <div className="flex items-center justify-between mb-5">
        <div className="relative">
          <button
            onClick={() => setShowCalendar(c => !c)}
            aria-label="Open calendar"
            aria-expanded={showCalendar}
            className="text-left group cursor-pointer min-h-11"
          >
            <h2
              className="font-condensed font-bold text-white uppercase tracking-wide leading-none mb-1 group-hover:text-accent transition-colors"
              style={{ fontSize: '1.75rem' }}
            >
              {displayDate(date)}
            </h2>
          </button>
          {session && <SplitBadge split={session.split_type} />}
          {showCalendar && (
            <CalendarPopover
              date={date}
              onSelect={d => goToDate(d)}
              onClose={() => setShowCalendar(false)}
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={prevDay}
            aria-label="Previous day"
            className="w-11 h-11 flex items-center justify-center rounded-xl bg-card border border-border text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >←</button>
          <button
            onClick={nextDay}
            disabled={isToday}
            aria-label="Next day"
            className="w-11 h-11 flex items-center justify-center rounded-xl bg-card border border-border text-zinc-400 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
          >→</button>
        </div>
      </div>

      {/* Split day selector */}
      {splitDays.length > 0 && (
        <div className="flex gap-2 mb-5 flex-wrap">
          {splitDays.map(day => {
            const isActive = currentSplitLabel === day.label
            const activeStyle = ACTIVE_STYLES[day.label] ?? FALLBACK_ACTIVE
            return (
              <button
                key={day.id}
                onClick={() => handleSplitChange(day.label)}
                aria-pressed={isActive}
                className={`flex-1 min-w-0 min-h-11 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border cursor-pointer ${
                  isActive ? activeStyle : 'border-border text-zinc-500 hover:text-zinc-300 hover:border-zinc-600'
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
          <div className="flex items-center justify-between gap-2">
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
              aria-pressed={editMode}
              className={`px-4 min-h-11 rounded-xl text-sm font-medium border transition-colors cursor-pointer ${
                editMode ? 'border-accent text-accent' : 'border-border text-zinc-400 hover:text-white'
              }`}
            >
              {editMode ? 'Done' : 'Edit'}
            </button>
          </div>
          {session.notes && !editMode && (
            <p className="text-zinc-400 text-sm mt-3 pt-3 border-t border-border">{session.notes}</p>
          )}
        </div>
      )}

      {/* Strength exercises */}
      {strengthExercises.map(ex => (
        <ExerciseCard
          key={ex.id}
          exercise={ex}
          history={history.get(ex.name) ?? EMPTY_HISTORY}
          readOnly={session ? !editMode : false}
          onDelete={deleteExercise}
          onRename={(id, name) => guard(() => updateExercise(id, { name }), 'Could not rename exercise')}
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
          onEdit={(exercise) => setCardioForm({ mode: 'edit', exercise })}
        />
      ))}

      {/* Add exercise (only when editing or no session yet) */}
      {(!session || editMode) && (
        <div className="mt-2">
          <ExerciseAutocomplete
            onAdd={handleAddExercise}
            onAddCardio={(name) => setCardioForm({ mode: 'create', initialActivity: name })}
            search={search}
            searchCardio={searchCardio}
          />
        </div>
      )}

      {/* Session notes */}
      {session && (
        <div className="mt-5">
          <label htmlFor="session-notes" className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Session notes</label>
          <textarea
            id="session-notes"
            value={session.notes ?? ''}
            onChange={e => updateNotes(e.target.value)}
            placeholder="How did it feel? Any PRs? Notes…"
            rows={3}
            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-white placeholder-zinc-600 text-base resize-none focus:outline-none focus:border-accent transition-colors"
          />
        </div>
      )}

      {/* Cardio prompt at the bottom */}
      <div className="flex items-center justify-between gap-2 mt-5 pt-4 border-t border-border">
        <span className="text-xs text-zinc-500">
          {cardioExercises.length > 0 ? 'Add more cardio' : 'Add cardio for today'}
        </span>
        <button
          onClick={() => setCardioForm({ mode: 'create', initialActivity: null })}
          className="px-4 min-h-11 rounded-xl text-xs font-bold uppercase tracking-wider border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors cursor-pointer"
        >
          + Cardio
        </button>
      </div>

      {toasts}
    </div>
  )
}

function SegControl({ tab, navigate }) {
  return (
    <nav aria-label="View" className="flex bg-card border border-border rounded-xl p-1 gap-1 mb-5">
      {['day', 'week', 'month'].map(t => (
        <button
          key={t}
          onClick={() => navigate(TAB_ROUTES[t])}
          aria-current={tab === t ? 'page' : undefined}
          className={`flex-1 min-h-11 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
            tab === t
              ? 'bg-zinc-800 text-white border border-zinc-700'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          {t}
        </button>
      ))}
    </nav>
  )
}
