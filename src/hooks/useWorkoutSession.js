import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { renumberItems } from '../lib/orderUtils'

export function useWorkoutSession(date) {
  const [session, setSession] = useState(null)
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saveState, setSaveState] = useState('idle') // 'idle' | 'saving' | 'error'

  const saveTimers = useRef({})
  const savePending = useRef({}) // key -> { table, id, fields }

  // Merges fields for same key so rapid updates don't lose prior fields.
  function scheduleWrite(key, table, id, fields) {
    clearTimeout(saveTimers.current[key])
    savePending.current[key] = {
      table, id,
      fields: { ...(savePending.current[key]?.fields ?? {}), ...fields },
    }
    setSaveState('saving')
    saveTimers.current[key] = setTimeout(async () => {
      const payload = savePending.current[key]
      if (!payload) return
      try {
        const { error: err } = await supabase.from(payload.table).update(payload.fields).eq('id', payload.id)
        if (err) throw err
        delete savePending.current[key]
        delete saveTimers.current[key]
        if (Object.keys(savePending.current).length === 0) setSaveState('idle')
      } catch {
        setSaveState('error')
      }
    }, 600)
  }

  const flushPending = useCallback(async () => {
    const pending = { ...savePending.current }
    savePending.current = {}
    for (const key of Object.keys(saveTimers.current)) {
      clearTimeout(saveTimers.current[key])
    }
    saveTimers.current = {}
    if (Object.keys(pending).length === 0) return
    await Promise.all(
      Object.values(pending).map(({ table, id, fields }) =>
        supabase.from(table).update(fields).eq('id', id)
      )
    )
  }, [])

  const loadSession = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: sessionData, error: sErr } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', date)
        .maybeSingle()

      if (sErr) throw sErr
      setSession(sessionData)

      if (sessionData) {
        await loadExercises(sessionData.id)
      } else {
        setExercises([])
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [date])

  async function loadExercises(sessionId) {
    const { data: exData, error: exErr } = await supabase
      .from('exercises')
      .select('*, sets(*, dropsets(*)), cardio_entries(*)')
      .eq('session_id', sessionId)
      .order('exercise_order')

    if (exErr) throw exErr
    const normalized = (exData ?? []).map(ex => ({
      ...ex,
      sets: (ex.sets ?? [])
        .sort((a, b) => a.set_number - b.set_number)
        .map(s => ({ ...s, dropsets: (s.dropsets ?? []).sort((a, b) => a.drop_order - b.drop_order) })),
      cardio_entry: (ex.cardio_entries ?? [])[0] ?? null,
    }))
    setExercises(normalized)
  }

  useEffect(() => {
    flushPending().then(() => loadSession())
    return () => { flushPending() }
  }, [loadSession, flushPending])

  async function retrySave() {
    const pending = { ...savePending.current }
    if (Object.keys(pending).length === 0) return
    setSaveState('saving')
    for (const [key, { table, id, fields }] of Object.entries(pending)) {
      try {
        const { error: err } = await supabase.from(table).update(fields).eq('id', id)
        if (err) throw err
        delete savePending.current[key]
      } catch {
        setSaveState('error')
        return
      }
    }
    setSaveState('idle')
  }

  async function ensureSession(splitType = 'Push') {
    if (session) return session
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error: err } = await supabase
      .from('workout_sessions')
      .upsert(
        { user_id: user.id, date, split_type: splitType },
        { onConflict: 'user_id,date' }
      )
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
    setSession(data)
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

  async function addExercise(name, splitType = null, exerciseType = 'strength') {
    const s = await ensureSession(splitType)
    const order = exercises.length + 1
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
    const order = exercises.length + 1
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
    if (entryErr) throw entryErr
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
    setExercises(prev => prev.map(e =>
      e.id === exerciseId ? { ...e, cardio_entry: data } : e
    ))
  }

  async function updateExercise(exerciseId, fields) {
    const { error: err } = await supabase.from('exercises').update(fields).eq('id', exerciseId)
    if (err) throw err
    setExercises(prev => prev.map(ex => ex.id === exerciseId ? { ...ex, ...fields } : ex))
  }

  async function deleteExercise(exerciseId) {
    const { error: err } = await supabase.from('exercises').delete().eq('id', exerciseId)
    if (err) throw err
    setExercises(prev => {
      const filtered = prev.filter(ex => ex.id !== exerciseId)
      const renumbered = renumberItems(filtered, 'exercise_order')
      renumbered.forEach((ex, i) => {
        if (filtered[i].exercise_order !== ex.exercise_order) {
          supabase.from('exercises').update({ exercise_order: ex.exercise_order }).eq('id', ex.id)
        }
      })
      return renumbered
    })
  }

  async function addSet(exerciseId, weight, reps) {
    const ex = exercises.find(e => e.id === exerciseId)
    const setNumber = (ex?.sets?.length ?? 0) + 1
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
      sets: ex.sets.map(s => s.id === setId ? { ...s, ...fields } : s),
    })))
    scheduleWrite(`set-${setId}`, 'sets', setId, fields)
  }

  async function deleteSet(setId) {
    const { error: err } = await supabase.from('sets').delete().eq('id', setId)
    if (err) throw err
    setExercises(prev => prev.map(ex => {
      if (!ex.sets.some(s => s.id === setId)) return ex
      const filtered = ex.sets.filter(s => s.id !== setId)
      const renumbered = renumberItems(filtered, 'set_number')
      renumbered.forEach((s, i) => {
        if (filtered[i].set_number !== s.set_number) {
          supabase.from('sets').update({ set_number: s.set_number }).eq('id', s.id)
        }
      })
      return { ...ex, sets: renumbered }
    }))
  }

  async function addDropset(setId, weight, reps) {
    const parentSet = exercises.flatMap(e => e.sets).find(s => s.id === setId)
    const dropOrder = (parentSet?.dropsets?.length ?? 0) + 1
    const { data, error: err } = await supabase
      .from('dropsets')
      .insert({ set_id: setId, drop_order: dropOrder, weight, reps })
      .select()
      .single()
    if (err) throw err
    setExercises(prev => prev.map(ex => ({
      ...ex,
      sets: ex.sets.map(s =>
        s.id === setId ? { ...s, dropsets: [...s.dropsets, data] } : s
      ),
    })))
    return data
  }

  function updateDropset(dropsetId, fields) {
    setExercises(prev => prev.map(ex => ({
      ...ex,
      sets: ex.sets.map(s => ({
        ...s,
        dropsets: s.dropsets.map(d => d.id === dropsetId ? { ...d, ...fields } : d),
      })),
    })))
    scheduleWrite(`drop-${dropsetId}`, 'dropsets', dropsetId, fields)
  }

  async function deleteDropset(dropsetId) {
    const { error: err } = await supabase.from('dropsets').delete().eq('id', dropsetId)
    if (err) throw err
    setExercises(prev => prev.map(ex => ({
      ...ex,
      sets: ex.sets.map(s => {
        if (!s.dropsets.some(d => d.id === dropsetId)) return s
        const filtered = s.dropsets.filter(d => d.id !== dropsetId)
        const renumbered = renumberItems(filtered, 'drop_order')
        renumbered.forEach((d, i) => {
          if (filtered[i].drop_order !== d.drop_order) {
            supabase.from('dropsets').update({ drop_order: d.drop_order }).eq('id', d.id)
          }
        })
        return { ...s, dropsets: renumbered }
      }),
    })))
  }

  return {
    session, exercises, loading, error,
    saveState, retrySave,
    updateSession, updateNotes, deleteSession,
    addExercise, updateExercise, deleteExercise,
    addCardioExercise, updateCardioEntry,
    addSet, updateSet, deleteSet,
    addDropset, updateDropset, deleteDropset,
    refresh: loadSession,
  }
}
