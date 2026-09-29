import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { getUserId } from '../lib/session'
import { bestE1RM } from '../lib/strength'

// History for the exercise cards: the most recent prior session's sets, plus the
// all-time best set by e1RM and by single-set volume. Sessions on currentDate are
// excluded.
//
// This used to be a per-card hook, so a six-exercise session fired six identical
// history queries — each preceded by its own network getUser() call, twelve
// requests in total. It now takes every name at once and issues ONE query, and
// reads the user id from the local session instead of the network.

function computeFor(name, sessions, currentDate) {
  // sessions arrives newest-first; keep only those containing this exercise.
  const relevant = []
  for (const s of sessions) {
    const ex = s.exercises?.find(e => e.name === name)
    if (ex) relevant.push({ date: s.date, sets: ex.sets ?? [] })
  }
  if (!relevant.length) {
    return { lastSets: [], lastDate: null, daysAgo: null, bestSet: null, bestVolumeSet: null }
  }

  const recent = relevant[0]
  const lastSets = recent.sets.slice().sort((a, b) => a.set_number - b.set_number)

  const allSets = relevant.flatMap(r => r.sets)
  const { e1rm, set: e1rmSet } = bestE1RM(allSets)

  let volumeSet = null
  let maxVolume = 0
  for (const set of allSets) {
    const v = set.weight * set.reps
    if (v > maxVolume) { maxVolume = v; volumeSet = set }
  }

  // Noon anchor keeps the day count correct across DST boundaries.
  const curr = new Date(currentDate + 'T12:00:00')
  const last = new Date(recent.date + 'T12:00:00')
  const daysAgo = Math.round((curr - last) / (1000 * 60 * 60 * 24))

  return {
    lastSets,
    lastDate: recent.date,
    daysAgo,
    bestSet: e1rmSet ? { set: e1rmSet, e1rm } : null,
    bestVolumeSet: volumeSet ? { set: volumeSet, volume: maxVolume } : null,
  }
}

export const EMPTY_HISTORY = {
  lastSets: [], lastDate: null, daysAgo: null, bestSet: null, bestVolumeSet: null,
}

/**
 * @param {string[]} names exercise names to look up
 * @param {string}   currentDate ISO date to measure "days ago" against
 * @returns {Map<string, typeof EMPTY_HISTORY>}
 */
export function useSessionHistory(names, currentDate) {
  const [history, setHistory] = useState(() => new Map())

  // Stable dependency: a new array identity each render must not refetch.
  const nameKey = useMemo(
    () => [...new Set(names ?? [])].filter(Boolean).sort().join('\u0000'),
    [names]
  )

  useEffect(() => {
    const list = nameKey ? nameKey.split('\u0000') : []
    if (!list.length || !currentDate) {
      setHistory(new Map())
      return undefined
    }

    let cancelled = false
    ;(async () => {
      try {
        const userId = await getUserId()
        if (!userId || cancelled) return

        // Filter on workout_sessions so user_id and date apply to the root table;
        // exercises!inner restricts to sessions containing one of these names.
        const { data: sessions, error } = await supabase
          .from('workout_sessions')
          .select('id, date, exercises!inner(id, name, exercise_type, sets(weight, reps, set_number))')
          .eq('user_id', userId)
          .in('exercises.name', list)
          .eq('exercises.exercise_type', 'strength')
          .lt('date', currentDate)
          .order('date', { ascending: false })

        if (error) throw error
        if (cancelled) return

        const next = new Map()
        for (const name of list) next.set(name, computeFor(name, sessions ?? [], currentDate))
        setHistory(next)
      } catch (err) {
        // History is decorative; a failure must not take the logging screen down.
        console.error('useSessionHistory:', err)
      }
    })()

    return () => { cancelled = true }
  }, [nameKey, currentDate])

  return history
}
