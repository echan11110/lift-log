import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getUserId } from '../lib/session'

// Autocomplete name lists.
//
// Two notes on robustness:
//   * The user id comes from the local session, not a network getUser() call.
//   * A missing RPC is tolerated. distinct_cardio_names is absent from databases
//     whose v2 migration block predates it (see the v4 block in docs/schema.sql),
//     where it was 404-ing on every single page load. Cardio suggestions degrade
//     to empty instead of producing an error storm.

const MISSING_FUNCTION = 'PGRST202'

// Remembered for the page's lifetime so a function that isn't deployed is
// requested once rather than on every load and every refresh.
const missingRpcs = new Set()

async function callNameRpc(fn, userId) {
  if (missingRpcs.has(fn)) return null
  const { data, error } = await supabase.rpc(fn, { p_user_id: userId })
  if (error) {
    if (error.code === MISSING_FUNCTION) {
      missingRpcs.add(fn)
      return null
    }
    throw error
  }
  return data ?? []
}

export function useExerciseNames() {
  const [names, setNames] = useState([])
  const [cardioNames, setCardioNames] = useState([])
  const [cardioRpcMissing, setCardioRpcMissing] = useState(false)

  const load = useCallback(async () => {
    try {
      const userId = await getUserId()
      if (!userId) return
      const [strength, cardio] = await Promise.all([
        callNameRpc('distinct_exercise_names', userId),
        callNameRpc('distinct_cardio_names', userId),
      ])
      if (strength) setNames(strength)
      if (cardio) setCardioNames(cardio)
      else setCardioRpcMissing(true)
    } catch (err) {
      console.error('useExerciseNames:', err)
    }
  }, [])

  useEffect(() => { void load() }, [load])

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

  return { names, cardioNames, search, searchCardio, refresh: load, cardioRpcMissing }
}
