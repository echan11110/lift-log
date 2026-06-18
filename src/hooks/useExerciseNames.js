import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useExerciseNames() {
  const [names, setNames] = useState([])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.rpc('distinct_exercise_names', { p_user_id: user.id })
      if (data) setNames(data)
    }
    load()
  }, [])

  const search = useCallback((query) => {
    if (!query) return names.slice(0, 8)
    const q = query.toLowerCase()
    return names.filter(n => n.toLowerCase().includes(q)).slice(0, 8)
  }, [names])

  const refresh = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.rpc('distinct_exercise_names', { p_user_id: user.id })
    if (data) setNames(data)
  }, [])

  return { names, search, refresh }
}
