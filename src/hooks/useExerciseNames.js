import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useExerciseNames() {
  const [names, setNames] = useState([])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('exercises')
        .select('name, workout_sessions!inner(user_id)')
        .eq('workout_sessions.user_id', user.id)
      if (data) {
        const unique = [...new Set(data.map(r => r.name))].sort()
        setNames(unique)
      }
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
    const { data } = await supabase
      .from('exercises')
      .select('name, workout_sessions!inner(user_id)')
      .eq('workout_sessions.user_id', user.id)
    if (data) {
      const unique = [...new Set(data.map(r => r.name))].sort()
      setNames(unique)
    }
  }, [])

  return { names, search, refresh }
}
