import { supabase } from './supabase'
import { getUserId } from './session'

// Full data export.
//
// Until now there was no way to get training history out of the app, and because
// the passphrase is hashed into a synthetic @lift-log.app address there is no
// password reset either — so a forgotten passphrase meant the data was gone for
// good. This is the backup that makes that survivable.

const NESTED = `
  id, date, split_type, notes, created_at,
  exercises (
    id, name, exercise_type, exercise_order, created_at,
    sets ( id, set_number, weight, reps, created_at,
           dropsets ( id, drop_order, weight, reps ) ),
    cardio_entries ( id, duration_sec, distance_m, distance_unit,
                     avg_pace_sec, calories, resistance_level )
  )
`

/** Fetch every session with its exercises, sets, dropsets and cardio entries. */
export async function fetchAllData() {
  const userId = await getUserId()
  if (!userId) throw new Error('Not signed in')

  let { data, error } = await supabase
    .from('workout_sessions')
    .select(NESTED)
    .eq('user_id', userId)
    .order('date', { ascending: true })

  // Same defensive fallback loadExercises uses: a database without the v2 cardio
  // migration has no cardio_entries relation.
  if (error?.message?.includes('cardio_entries')) {
    const retry = await supabase
      .from('workout_sessions')
      .select(NESTED.replace(/,\s*cardio_entries \([^)]*\)/, ''))
      .eq('user_id', userId)
      .order('date', { ascending: true })
    data = retry.data
    error = retry.error
  }

  if (error) throw error

  // Sort children deterministically so exports diff cleanly between runs.
  return (data ?? []).map(s => ({
    ...s,
    exercises: (s.exercises ?? [])
      .slice()
      .sort((a, b) => a.exercise_order - b.exercise_order)
      .map(ex => ({
        ...ex,
        sets: (ex.sets ?? [])
          .slice()
          .sort((a, b) => a.set_number - b.set_number)
          .map(st => ({
            ...st,
            dropsets: (st.dropsets ?? []).slice().sort((a, b) => a.drop_order - b.drop_order),
          })),
      })),
  }))
}

function csvCell(value) {
  if (value === null || value === undefined) return ''
  const s = String(value)
  // Quote when the value could otherwise break the row, and double inner quotes.
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const COLUMNS = [
  'date', 'split', 'exercise', 'type', 'exercise_order',
  'set_number', 'weight', 'reps',
  'dropset_order', 'dropset_weight', 'dropset_reps',
  'cardio_duration_sec', 'cardio_distance', 'cardio_unit',
  'cardio_pace_sec', 'cardio_calories', 'cardio_resistance',
  'session_notes',
]

/**
 * Flatten to one row per logged thing: a row per set, a row per dropset, a row
 * per cardio entry, and a bare row for an exercise with nothing logged yet, so
 * nothing silently disappears from the spreadsheet.
 */
export function toCSV(sessions) {
  const rows = [COLUMNS.join(',')]

  for (const s of sessions) {
    const base = { date: s.date, split: s.split_type, session_notes: s.notes }

    if (!s.exercises?.length) {
      rows.push(COLUMNS.map(c => csvCell(base[c])).join(','))
      continue
    }

    for (const ex of s.exercises) {
      const exBase = {
        ...base,
        exercise: ex.name,
        type: ex.exercise_type ?? 'strength',
        exercise_order: ex.exercise_order,
      }
      const cardio = (ex.cardio_entries ?? [])[0]
      let wrote = false

      for (const st of ex.sets ?? []) {
        rows.push(COLUMNS.map(c => csvCell({
          ...exBase, set_number: st.set_number, weight: st.weight, reps: st.reps,
        }[c])).join(','))
        wrote = true

        for (const d of st.dropsets ?? []) {
          rows.push(COLUMNS.map(c => csvCell({
            ...exBase,
            set_number: st.set_number,
            dropset_order: d.drop_order,
            dropset_weight: d.weight,
            dropset_reps: d.reps,
          }[c])).join(','))
        }
      }

      if (cardio) {
        rows.push(COLUMNS.map(c => csvCell({
          ...exBase,
          cardio_duration_sec: cardio.duration_sec,
          cardio_distance: cardio.distance_m,
          cardio_unit: cardio.distance_unit,
          cardio_pace_sec: cardio.avg_pace_sec,
          cardio_calories: cardio.calories,
          cardio_resistance: cardio.resistance_level,
        }[c])).join(','))
        wrote = true
      }

      if (!wrote) rows.push(COLUMNS.map(c => csvCell(exBase[c])).join(','))
    }
  }

  return rows.join('\n')
}

export function summarize(sessions) {
  let exercises = 0, sets = 0, dropsets = 0, cardio = 0
  for (const s of sessions) {
    for (const ex of s.exercises ?? []) {
      exercises++
      cardio += (ex.cardio_entries ?? []).length
      for (const st of ex.sets ?? []) {
        sets++
        dropsets += (st.dropsets ?? []).length
      }
    }
  }
  return { sessions: sessions.length, exercises, sets, dropsets, cardio }
}

function download(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke on the next tick so Safari has actually started the download.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

function stamp() {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Fetch everything and save it. `format` is 'json' or 'csv'. Returns a summary. */
export async function exportData(format = 'json') {
  const sessions = await fetchAllData()
  if (format === 'csv') {
    download(`lift-log-${stamp()}.csv`, toCSV(sessions), 'text/csv;charset=utf-8')
  } else {
    const payload = {
      app: 'lift-log',
      schema: 1,
      exported_at: new Date().toISOString(),
      counts: summarize(sessions),
      sessions,
    }
    download(`lift-log-${stamp()}.json`, JSON.stringify(payload, null, 2), 'application/json')
  }
  return summarize(sessions)
}
