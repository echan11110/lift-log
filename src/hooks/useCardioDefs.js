import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

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
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('cardio_exercise_defs')
      .insert({ user_id: user.id, name, unit })
      .select()
      .single()
    if (error) throw error
    setDefs(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    return data
  }, [])

  return { defs, loading, getUnit, addDef }
}
