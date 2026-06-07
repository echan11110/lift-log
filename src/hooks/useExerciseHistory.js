import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Returns the most recent prior session's sets for a given exercise name,
// plus the all-time PR weight. Excludes any session on currentDate.
export function useExerciseHistory(name, currentDate) {
  const [lastSets, setLastSets] = useState([])
  const [lastDate, setLastDate] = useState(null)
  const [daysAgo, setDaysAgo] = useState(null)
  const [allTimePR, setAllTimePR] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!name || !currentDate) return
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Single query: all past occurrences of this exercise with their sets,
        // newest first. Excludes today so in-progress session never shows as "last time".
        const { data: rows } = await supabase
          .from('exercises')
          .select('id, sets(weight, reps, set_number), workout_sessions!inner(date, user_id)')
          .eq('name', name)
          .eq('workout_sessions.user_id', user.id)
          .lt('workout_sessions.date', currentDate)
          .order('workout_sessions(date)', { ascending: false })

        if (cancelled) return

        if (!rows?.length) {
          setLastSets([])
          setLastDate(null)
          setDaysAgo(null)
          setAllTimePR(0)
          return
        }

        // Most recent session = first row (desc order)
        const recent = rows[0]
        const recentDate = recent.workout_sessions?.date ?? null
        const recentSets = (recent.sets ?? []).sort((a, b) => a.set_number - b.set_number)

        // All-time PR = max weight across all historical sets
        let pr = 0
        for (const row of rows) {
          for (const s of row.sets ?? []) {
            if (s.weight > pr) pr = s.weight
          }
        }

        let ago = null
        if (recentDate) {
          const curr = new Date(currentDate + 'T12:00:00')
          const last = new Date(recentDate + 'T12:00:00')
          ago = Math.round((curr - last) / (1000 * 60 * 60 * 24))
        }

        setLastSets(recentSets)
        setLastDate(recentDate)
        setDaysAgo(ago)
        setAllTimePR(pr)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [name, currentDate])

  return { lastSets, lastDate, daysAgo, allTimePR, loading }
}
