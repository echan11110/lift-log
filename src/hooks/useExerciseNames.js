import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useExerciseNames() {
  const [names, setNames] = useState([])
  const [cardioNames, setCardioNames] = useState([])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: strength }, { data: cardio }] = await Promise.all([
        supabase.rpc('distinct_exercise_names', { p_user_id: user.id }),
        supabase.rpc('distinct_cardio_names', { p_user_id: user.id }),
      ])
      if (strength) setNames(strength)
      if (cardio) setCardioNames(cardio)
    }
    load()
  }, [])

  const search = useCallback((query) => {
    if (!query) return names.slice(0, 8)
    const q = query.toLowerCase()
    return names.filter(n => n.toLowerCase().includes(q)).slice(0, 8)
  }, [names])

  const searchCardio = useCallback((query) => {
    if (!query) return cardioNames.slice(0, 6)
    const q = query.toLowerCase()
    return cardioNames.filter(n => n.toLowerCase().includes(q)).slice(0, 6)
  }, [cardioNames])

  const refresh = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data: strength }, { data: cardio }] = await Promise.all([
      supabase.rpc('distinct_exercise_names', { p_user_id: user.id }),
      supabase.rpc('distinct_cardio_names', { p_user_id: user.id }),
    ])
    if (strength) setNames(strength)
    if (cardio) setCardioNames(cardio)
  }, [])

  return { names, cardioNames, search, searchCardio, refresh }
}
