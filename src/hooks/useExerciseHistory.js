import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { epley1RM } from '../lib/strength'

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

        // Query workout_sessions directly so user_id and date filters apply
        // to the root table — no embedded-filter ambiguity.
        // exercises!inner filters to sessions that contain this exercise name.
        const { data: sessions } = await supabase
          .from('workout_sessions')
          .select('id, date, exercises!inner(id, name, sets(weight, reps, set_number))')
          .eq('user_id', user.id)
          .eq('exercises.name', name)
          .lt('date', currentDate)
          .order('date', { ascending: false })

        if (cancelled) return

        if (!sessions?.length) {
          setLastSets([])
          setLastDate(null)
          setDaysAgo(null)
          setAllTimePR(0)
          return
        }

        // Most recent session = first row (desc order)
        const recent = sessions[0]
        const recentDate = recent.date
        // exercises is an array; find the one matching our exercise name
        const recentEx = recent.exercises?.find(e => e.name === name)
        const recentSets = (recentEx?.sets ?? []).sort((a, b) => a.set_number - b.set_number)

        // All-time PR = best e1RM across all historical sets for this exercise
        let pr = 0
        for (const s of sessions) {
          const ex = s.exercises?.find(e => e.name === name)
          for (const set of ex?.sets ?? []) {
            const e = epley1RM(set.weight, set.reps)
            if (e > pr) pr = e
          }
        }

        const curr = new Date(currentDate + 'T12:00:00')
        const last = new Date(recentDate + 'T12:00:00')
        const ago = Math.round((curr - last) / (1000 * 60 * 60 * 24))

        setLastSets(recentSets)
        setLastDate(recentDate)
        setDaysAgo(ago)
        setAllTimePR(pr)
      } catch (err) {
        console.error('useExerciseHistory:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [name, currentDate])

  return { lastSets, lastDate, daysAgo, allTimePR, loading }
}
