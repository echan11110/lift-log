import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

export function useWorkoutSession(date) {
  const [session, setSession] = useState(null)
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const saveTimers = useRef({})

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
      .select('*, sets(*, dropsets(*))')
      .eq('session_id', sessionId)
      .order('exercise_order')

    if (exErr) throw exErr
    const normalized = (exData ?? []).map(ex => ({
      ...ex,
      sets: (ex.sets ?? [])
        .sort((a, b) => a.set_number - b.set_number)
        .map(s => ({ ...s, dropsets: (s.dropsets ?? []).sort((a, b) => a.drop_order - b.drop_order) })),
    }))
    setExercises(normalized)
  }

  useEffect(() => { loadSession() }, [loadSession])

  async function ensureSession(splitType = 'Push') {
    if (session) return session
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('workout_sessions')
      .upsert(
        { user_id: user.id, date, split_type: splitType },
        { onConflict: 'user_id,date' }
      )
      .select()
      .single()
    if (error) throw error
    setSession(data)
    return data
  }

  async function updateSession(fields) {
    if (!session) return
    const { data, error } = await supabase
      .from('workout_sessions')
      .update(fields)
      .eq('id', session.id)
      .select()
      .single()
    if (error) throw error
    setSession(data)
  }

  async function deleteSession() {
    if (!session) return
    const { error } = await supabase.from('workout_sessions').delete().eq('id', session.id)
    if (error) throw error
    setSession(null)
    setExercises([])
  }

  async function addExercise(name, splitType = 'Push') {
    const s = await ensureSession(splitType)
    const order = exercises.length
    const { data, error } = await supabase
      .from('exercises')
      .insert({ session_id: s.id, name, exercise_order: order })
      .select()
      .single()
    if (error) throw error
    setExercises(prev => [...prev, { ...data, sets: [] }])
    return data
  }

  async function deleteExercise(exerciseId) {
    const { error } = await supabase.from('exercises').delete().eq('id', exerciseId)
    if (error) throw error
    setExercises(prev => prev.filter(ex => ex.id !== exerciseId))
  }

  async function addSet(exerciseId, weight, reps) {
    const ex = exercises.find(e => e.id === exerciseId)
    const setNumber = (ex?.sets?.length ?? 0) + 1
    const { data, error } = await supabase
      .from('sets')
      .insert({ exercise_id: exerciseId, set_number: setNumber, weight, reps })
      .select()
      .single()
    if (error) throw error
    setExercises(prev => prev.map(e =>
      e.id === exerciseId ? { ...e, sets: [...e.sets, { ...data, dropsets: [] }] } : e
    ))
    return data
  }

  async function updateSet(setId, fields) {
    const key = `set-${setId}`
    clearTimeout(saveTimers.current[key])
    setExercises(prev => prev.map(ex => ({
      ...ex,
      sets: ex.sets.map(s => s.id === setId ? { ...s, ...fields } : s),
    })))
    saveTimers.current[key] = setTimeout(async () => {
      await supabase.from('sets').update(fields).eq('id', setId)
    }, 600)
  }

  async function deleteSet(setId) {
    const { error } = await supabase.from('sets').delete().eq('id', setId)
    if (error) throw error
    setExercises(prev => prev.map(ex => ({
      ...ex,
      sets: ex.sets.filter(s => s.id !== setId),
    })))
  }

  async function addDropset(setId, weight, reps) {
    const parentSet = exercises.flatMap(e => e.sets).find(s => s.id === setId)
    const dropOrder = (parentSet?.dropsets?.length ?? 0) + 1
    const { data, error } = await supabase
      .from('dropsets')
      .insert({ set_id: setId, drop_order: dropOrder, weight, reps })
      .select()
      .single()
    if (error) throw error
    setExercises(prev => prev.map(ex => ({
      ...ex,
      sets: ex.sets.map(s =>
        s.id === setId ? { ...s, dropsets: [...s.dropsets, data] } : s
      ),
    })))
    return data
  }

  async function updateDropset(dropsetId, fields) {
    const key = `drop-${dropsetId}`
    clearTimeout(saveTimers.current[key])
    setExercises(prev => prev.map(ex => ({
      ...ex,
      sets: ex.sets.map(s => ({
        ...s,
        dropsets: s.dropsets.map(d => d.id === dropsetId ? { ...d, ...fields } : d),
      })),
    })))
    saveTimers.current[key] = setTimeout(async () => {
      await supabase.from('dropsets').update(fields).eq('id', dropsetId)
    }, 600)
  }

  async function deleteDropset(dropsetId) {
    const { error } = await supabase.from('dropsets').delete().eq('id', dropsetId)
    if (error) throw error
    setExercises(prev => prev.map(ex => ({
      ...ex,
      sets: ex.sets.map(s => ({
        ...s,
        dropsets: s.dropsets.filter(d => d.id !== dropsetId),
      })),
    })))
  }

  return {
    session, exercises, loading, error,
    updateSession, deleteSession,
    addExercise, deleteExercise,
    addSet, updateSet, deleteSet,
    addDropset, updateDropset, deleteDropset,
    refresh: loadSession,
  }
}
