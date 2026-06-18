// Use local date methods (not UTC) so the date string always matches
// the user's timezone — toISOString() would return yesterday for UTC+ zones
// early in the day.
export function toDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function displayDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

export function shortDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function weekRange(date) {
  // Parse with noon local time so getDay/getDate use the correct local date
  const d = new Date(date + 'T12:00:00')
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(d)
  mon.setDate(d.getDate() + diff)
  const days = []
  for (let i = 0; i < 7; i++) {
    const dd = new Date(mon)
    dd.setDate(mon.getDate() + i)
    days.push(toDateStr(dd))
  }
  return days
}

export function monthDays(year, month) {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const days = []
  const startDow = first.getDay()
  const lead = startDow === 0 ? 6 : startDow - 1
  for (let i = 0; i < lead; i++) {
    const d = new Date(year, month, -lead + 1 + i)
    days.push({ dateStr: toDateStr(d), thisMonth: false })
  }
  for (let d = 1; d <= last.getDate(); d++) {
    days.push({ dateStr: toDateStr(new Date(year, month, d)), thisMonth: true })
  }
  const trail = 7 - (days.length % 7)
  if (trail < 7) {
    for (let i = 1; i <= trail; i++) {
      const d = new Date(year, month + 1, i)
      days.push({ dateStr: toDateStr(d), thisMonth: false })
    }
  }
  return days
}

export function sessionVolume(exercises) {
  return exercises.reduce((total, ex) => {
    if (ex.exercise_type === 'cardio') return total
    const setVol = (ex.sets ?? []).reduce((sv, s) => {
      const dropVol = (s.dropsets ?? []).reduce((dv, d) => dv + d.weight * d.reps, 0)
      return sv + s.weight * s.reps + dropVol
    }, 0)
    return total + setVol
  }, 0)
}

export function cardioDuration(exercises) {
  return exercises
    .filter(ex => ex.exercise_type === 'cardio')
    .reduce((total, ex) => total + (ex.cardio_entry?.duration_sec ?? 0), 0)
}

export function formatDuration(totalSec) {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function todayStr() {
  return toDateStr(new Date())
}

export function DAY_LABELS() {
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
}
