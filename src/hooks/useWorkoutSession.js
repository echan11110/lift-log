import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { getUserId } from '../lib/session'
import { renumberItems } from '../lib/orderUtils'
import {
  scheduleWrite, flushNow, retryAll, subscribe, getState,
} from '../lib/writeQueue'

// How long a delete can be undone before it is committed to the database.
const UNDO_MS = 5000

export function useWorkoutSession(date) {
  const [session, setSession] = useState(null)
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [saveInfo, setSaveInfo] = useState(getState)
  const [pendingDelete, setPendingDelete] = useState(null)

  // Deletes are deferred so they can be undone. The timer and the commit live in
  // a ref so a route change or unmount can commit them immediately.
  const deleteRef = useRef(null)
  const loadSessionRef = useRef(null)

  useEffect(() => subscribe(setSaveInfo), [])

  // ---------------------------------------------------------------- deferred deletes

  const commitPendingDelete = useCallback(async () => {
    const entry = deleteRef.current
    if (!entry) return
    clearTimeout(entry.timer)
    deleteRef.current = null
    setPendingDelete(null)
    try {
      await entry.commit()
    } catch (err) {
      setActionError(err?.message ?? 'Delete failed')
    }
  }, [])

  const scheduleDelete = useCallback(async (label, commit) => {
    // Only one undoable delete at a time — commit any earlier one first.
    await commitPendingDelete()
    const entry = { label, commit, timer: null }
    entry.timer = setTimeout(() => { void commitPendingDelete() }, UNDO_MS)
    deleteRef.current = entry
    setPendingDelete({ label })
  }, [commitPendingDelete])

  const undoDelete = useCallback(() => {
    const entry = deleteRef.current
    if (!entry) return
    clearTimeout(entry.timer)
    deleteRef.current = null
    setPendingDelete(null)
    // Nothing was written yet, so restoring is just a reload of server truth.
    void loadSessionRef.current?.()
  }, [])

  // ---------------------------------------------------------------- loading

  const loadExercises = useCallback(async (sessionId) => {
    let { data: exData, error: exErr } = await supabase
      .from('exercises')
      .select('*, sets(*, dropsets(*)), cardio_entries(*)')
      .eq('session_id', sessionId)
      .order('exercise_order')

    // cardio_entries table missing (v2 migration not yet run) — fall back
    // to strength-only query so existing data still loads
    if (exErr?.message?.includes('cardio_entries')) {
      const fallback = await supabase
        .from('exercises')
        .select('*, sets(*, dropsets(*))')
        .eq('session_id', sessionId)
        .order('exercise_order')
      exData = fallback.data
      exErr = fallback.error
    }

    if (exErr) throw exErr
    const normalized = (exData ?? []).map(ex => ({
      ...ex,
      exercise_type: ex.exercise_type ?? 'strength',
      sets: (ex.sets ?? [])
        .sort((a, b) => a.set_number - b.set_number)
        .map(s => ({ ...s, dropsets: (s.dropsets ?? []).sort((a, b) => a.drop_order - b.drop_order) })),
      cardio_entry: (ex.cardio_entries ?? [])[0] ?? null,
    }))
    setExercises(normalized)
  }, [])

  const loadSession = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const userId = await getUserId()
      if (!userId) return

      const { data: sessionData, error: sErr } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('date', date)
        .maybeSingle()

      if (sErr) throw sErr
      setSession(sessionData)

      if (sessionData) await loadExercises(sessionData.id)
      else setExercises([])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [date, loadExercises])

  useEffect(() => { loadSessionRef.current = loadSession }, [loadSession])

  useEffect(() => {
    let alive = true
    ;(async () => {
      await commitPendingDelete()
      await flushNow()
      if (alive) await loadSession()
    })()
    return () => {
      alive = false
      void commitPendingDelete()
      // Queued writes are already mirrored to localStorage, so this is only a
      // speed-up; anything unfinished replays on the next load.
      void flushNow()
    }
  }, [loadSession, commitPendingDelete])

  // ---------------------------------------------------------------- helpers

  /** Run a mutation, surfacing failures instead of throwing out of an onClick. */
  const guard = useCallback(async (fn, fallbackMsg = 'Something went wrong') => {
    try {
      setActionError(null)
      return await fn()
    } catch (err) {
      setActionError(err?.message ?? fallbackMsg)
      return null
    }
  }, [])

  /**
   * Renumber an ordering column after a delete.
   * Awaited, error-checked, and run OUTSIDE any setState updater — the previous
   * version fired these as floating promises from inside a state updater, so the
   * writes were silently dropped and reloads showed gaps like 1,3. A later insert
   * then derived its number from the row count and collided.
   * Ascending order matters: shifting values down never transiently collides,
   * which keeps the unique ordering indexes satisfiable.
   */
  async function persistRenumber(table, orderField, before, after) {
    for (let i = 0; i < after.length; i++) {
      if (before[i][orderField] === after[i][orderField]) continue
      const { error: err } = await supabase
        .from(table)
        .update({ [orderField]: after[i][orderField] })
        .eq('id', after[i].id)
      if (err) throw err
    }
  }

  // Next ordering value from the max, not the count — a gap left by an earlier
  // failed renumber made count+1 collide with an existing row.
  const nextOrder = (items, field) =>
    items.reduce((max, it) => Math.max(max, it[field] ?? 0), 0) + 1

  // ---------------------------------------------------------------- session

  async function ensureSession(splitType = 'Push') {
    if (session) return session
    const userId = await getUserId()
    if (!userId) throw new Error('Your session expired — sign in again to keep logging.')
    const { data, error: err } = await supabase
      .from('workout_sessions')
      .upsert({ user_id: userId, date, split_type: splitType }, { onConflict: 'user_id,date' })
      .select()
      .single()
    if (err) throw err
    setSession(data)
    return data
  }

  async function updateSession(fields) {
    if (!session) return
    const { data, error: err } = await supabase
      .from('workout_sessions')
      .update(fields)
      .eq('id', session.id)
      .select()
      .single()
    if (err) throw err
    // Merge rather than replace: replacing discarded notes keystrokes that were
    // still sitting in the debounce buffer.
    setSession(prev => ({ ...prev, ...data }))
  }

  function updateNotes(notes) {
    if (!session) return
    setSession(prev => ({ ...prev, notes }))
    scheduleWrite('session-notes', 'workout_sessions', session.id, { notes })
  }

  async function deleteSession() {
    if (!session) return
    const { error: err } = await supabase.from('workout_sessions').delete().eq('id', session.id)
    if (err) throw err
    setSession(null)
    setExercises([])
  }

  // ---------------------------------------------------------------- exercises

  async function addExercise(name, splitType = null, exerciseType = 'strength') {
    const s = await ensureSession(splitType)
    const order = nextOrder(exercises, 'exercise_order')
    const { data, error: err } = await supabase
      .from('exercises')
      .insert({ session_id: s.id, name, exercise_order: order, exercise_type: exerciseType })
      .select()
      .single()
    if (err) throw err
    setExercises(prev => [...prev, { ...data, sets: [], cardio_entry: null }])
    return data
  }

  async function addCardioExercise(name, splitType, cardioData) {
    const s = await ensureSession(splitType)
    const order = nextOrder(exercises, 'exercise_order')
    const { data: ex, error: exErr } = await supabase
      .from('exercises')
      .insert({ session_id: s.id, name, exercise_order: order, exercise_type: 'cardio' })
      .select()
      .single()
    if (exErr) throw exErr

    const { data: entry, error: entryErr } = await supabase
      .from('cardio_entries')
      .insert({ exercise_id: ex.id, ...cardioData })
      .select()
      .single()

    if (entryErr) {
      // These are two statements, not a transaction. Without this compensating
      // delete, a failed entry left a permanent orphan cardio exercise that
      // rendered as "No data logged." on every future visit.
      await supabase.from('exercises').delete().eq('id', ex.id)
      throw entryErr
    }

    setExercises(prev => [...prev, { ...ex, sets: [], cardio_entry: entry }])
    return { ex, entry }
  }

  async function updateCardioEntry(exerciseId, cardioData) {
    const ex = exercises.find(e => e.id === exerciseId)
    if (!ex?.cardio_entry) return
    const { data, error: err } = await supabase
      .from('cardio_entries')
      .update(cardioData)
      .eq('id', ex.cardio_entry.id)
      .select()
      .single()
    if (err) throw err
    setExercises(prev => prev.map(e => (e.id === exerciseId ? { ...e, cardio_entry: data } : e)))
  }

  async function updateExercise(exerciseId, fields) {
    const { error: err } = await supabase.from('exercises').update(fields).eq('id', exerciseId)
    if (err) throw err
    setExercises(prev => prev.map(ex => (ex.id === exerciseId ? { ...ex, ...fields } : ex)))
  }

  function deleteExercise(exerciseId) {
    const target = exercises.find(ex => ex.id === exerciseId)
    if (!target) return undefined
    const remaining = exercises.filter(ex => ex.id !== exerciseId)
    const renumbered = renumberItems(remaining, 'exercise_order')
    setExercises(renumbered)

    return scheduleDelete(target.name || 'Exercise', async () => {
      const { error: err } = await supabase.from('exercises').delete().eq('id', exerciseId)
      if (err) throw err
      await persistRenumber('exercises', 'exercise_order', remaining, renumbered)
    })
  }

  // ---------------------------------------------------------------- sets

  async function addSet(exerciseId, weight, reps) {
    const ex = exercises.find(e => e.id === exerciseId)
    const setNumber = nextOrder(ex?.sets ?? [], 'set_number')
    const { data, error: err } = await supabase
      .from('sets')
      .insert({ exercise_id: exerciseId, set_number: setNumber, weight, reps })
      .select()
      .single()
    if (err) throw err
    setExercises(prev => prev.map(e =>
      e.id === exerciseId ? { ...e, sets: [...e.sets, { ...data, dropsets: [] }] } : e
    ))
    return data
  }

  function updateSet(setId, fields) {
    setExercises(prev => prev.map(ex => ({
      ...ex,
      sets: ex.sets.map(s => (s.id === setId ? { ...s, ...fields } : s)),
    })))
    scheduleWrite(`set-${setId}`, 'sets', setId, fields)
  }

  function deleteSet(setId) {
    const parent = exercises.find(ex => ex.sets.some(s => s.id === setId))
    if (!parent) return undefined
    const remaining = parent.sets.filter(s => s.id !== setId)
    const renumbered = renumberItems(remaining, 'set_number')
    setExercises(prev => prev.map(ex =>
      ex.id === parent.id ? { ...ex, sets: renumbered } : ex
    ))

    return scheduleDelete('Set', async () => {
      const { error: err } = await supabase.from('sets').delete().eq('id', setId)
      if (err) throw err
      await persistRenumber('sets', 'set_number', remaining, renumbered)
    })
  }

  // ---------------------------------------------------------------- dropsets

  async function addDropset(setId, weight, reps) {
    const parentSet = exercises.flatMap(e => e.sets).find(s => s.id === setId)
    const dropOrder = nextOrder(parentSet?.dropsets ?? [], 'drop_order')
    const { data, error: err } = await supabase
      .from('dropsets')
      .insert({ set_id: setId, drop_order: dropOrder, weight, reps })
      .select()
      .single()
    if (err) throw err
    setExercises(prev => prev.map(ex => ({
      ...ex,
      sets: ex.sets.map(s => (s.id === setId ? { ...s, dropsets: [...s.dropsets, data] } : s)),
    })))
    return data
  }

  function updateDropset(dropsetId, fields) {
    setExercises(prev => prev.map(ex => ({
      ...ex,
      sets: ex.sets.map(s => ({
        ...s,
        dropsets: s.dropsets.map(d => (d.id === dropsetId ? { ...d, ...fields } : d)),
      })),
    })))
    scheduleWrite(`drop-${dropsetId}`, 'dropsets', dropsetId, fields)
  }

  function deleteDropset(dropsetId) {
    const parentSet = exercises
      .flatMap(e => e.sets)
      .find(s => s.dropsets.some(d => d.id === dropsetId))
    if (!parentSet) return undefined
    const remaining = parentSet.dropsets.filter(d => d.id !== dropsetId)
    const renumbered = renumberItems(remaining, 'drop_order')
    setExercises(prev => prev.map(ex => ({
      ...ex,
      sets: ex.sets.map(s => (s.id === parentSet.id ? { ...s, dropsets: renumbered } : s)),
    })))

    return scheduleDelete('Dropset', async () => {
      const { error: err } = await supabase.from('dropsets').delete().eq('id', dropsetId)
      if (err) throw err
      await persistRenumber('dropsets', 'drop_order', remaining, renumbered)
    })
  }

  return {
    session, exercises, loading, error,
    // Save status is derived from the durable queue, so it can no longer report
    // "saved" while something is still unwritten.
    saveState: saveInfo.status,
    pendingCount: saveInfo.pendingCount,
    failedCount: saveInfo.failedCount,
    saveErrorMessage: saveInfo.firstError,
    retrySave: retryAll,
    actionError,
    dismissActionError: () => setActionError(null),
    pendingDelete,
    undoDelete,
    guard,
    updateSession, updateNotes, deleteSession,
    addExercise, updateExercise, deleteExercise,
    addCardioExercise, updateCardioEntry,
    addSet, updateSet, deleteSet,
    addDropset, updateDropset, deleteDropset,
    refresh: loadSession,
  }
}
