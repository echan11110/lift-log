export function toDateStr(date) {
  return date.toISOString().slice(0, 10)
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
  const d = new Date(date)
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
    const setVol = ex.sets.reduce((sv, s) => {
      const dropVol = (s.dropsets ?? []).reduce((dv, d) => dv + d.weight * d.reps, 0)
      return sv + s.weight * s.reps + dropVol
    }, 0)
    return total + setVol
  }, 0)
}

export function todayStr() {
  return toDateStr(new Date())
}

export function DAY_LABELS() {
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
}
