import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getUserId } from '../lib/session'

export function useCardioDefs() {
  const [defs, setDefs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('cardio_exercise_defs')
        .select('*')
        .order('name')
      if (!error && data) setDefs(data)
      setLoading(false)
    }
    load()
  }, [])

  const getUnit = useCallback((name) => {
    const def = defs.find(d => d.name.toLowerCase() === name?.toLowerCase())
    return def?.unit ?? null
  }, [defs])

  const addDef = useCallback(async (name, unit) => {
    const userId = await getUserId()
    if (!userId) throw new Error('Your session expired — sign in again.')
    const { data, error } = await supabase
      .from('cardio_exercise_defs')
      .insert({ user_id: userId, name, unit })
      .select()
      .single()
    if (error) throw error
    setDefs(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    return data
  }, [])

  return { defs, loading, getUnit, addDef }
}
