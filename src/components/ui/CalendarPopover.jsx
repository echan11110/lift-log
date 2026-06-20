import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { toDateStr, monthDays, todayStr } from '../../lib/dateUtils'

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

export default function CalendarPopover({ date, onSelect, onClose }) {
  const today = todayStr()
  const initial = new Date(date + 'T12:00:00')

  const [year, setYear] = useState(initial.getFullYear())
  const [month, setMonth] = useState(initial.getMonth())
  const [loggedDates, setLoggedDates] = useState(new Set())
  const ref = useRef(null)

  const fetchMonth = useCallback(async (y, m) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const first = toDateStr(new Date(y, m, 1))
    const last  = toDateStr(new Date(y, m + 1, 0))
    const { data } = await supabase
      .from('workout_sessions')
      .select('date')
      .eq('user_id', user.id)
      .gte('date', first)
      .lte('date', last)
    if (data) setLoggedDates(new Set(data.map(s => s.date)))
  }, [])

  useEffect(() => { fetchMonth(year, month) }, [year, month, fetchMonth])

  useEffect(() => {
    function onMouse(e) { if (ref.current && !ref.current.contains(e.target)) onClose() }
    function onKey(e)   { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onMouse)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouse)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const now = new Date()
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth()

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    if (isCurrentMonth) return
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const days = monthDays(year, month)

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Pick a date"
      className="absolute top-full left-0 mt-2 z-50 bg-card border border-border rounded-2xl p-4 shadow-2xl"
      style={{ width: '17rem' }}
    >
      {/* Month nav */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={prevMonth}
          aria-label="Previous month"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
        >←</button>
        <span className="font-condensed font-bold text-white uppercase tracking-wide text-sm">
          {MONTH_NAMES[month]} {year}
        </span>
        <button
          onClick={nextMonth}
          disabled={isCurrentMonth}
          aria-label="Next month"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors disabled:opacity-30 cursor-pointer"
        >→</button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map(d => (
          <div key={d} className="text-center text-zinc-600 text-xs py-1 font-medium">{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map(({ dateStr, thisMonth }) => {
          const isFuture   = dateStr > today
          const isToday    = dateStr === today
          const isSelected = dateStr === date
          const hasLog     = loggedDates.has(dateStr)

          let cellClass = 'relative flex flex-col items-center justify-center h-9 w-full rounded-lg text-sm transition-colors '
          if (isFuture) {
            cellClass += 'opacity-20 cursor-default'
          } else if (isSelected) {
            cellClass += 'bg-accent text-white font-bold cursor-pointer'
          } else if (isToday) {
            cellClass += 'ring-1 ring-accent text-accent font-semibold hover:bg-accent/10 cursor-pointer'
          } else if (!thisMonth) {
            cellClass += 'text-zinc-700 hover:text-zinc-400 hover:bg-zinc-800 cursor-pointer'
          } else {
            cellClass += 'text-zinc-300 hover:bg-zinc-800 hover:text-white cursor-pointer'
          }

          return (
            <button
              key={dateStr}
              onClick={() => { if (!isFuture) { onSelect(dateStr); onClose() } }}
              disabled={isFuture}
              aria-label={dateStr}
              aria-pressed={isSelected}
              className={cellClass}
            >
              {new Date(dateStr + 'T12:00:00').getDate()}
              {hasLog && (
                <span
                  className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${
                    isSelected ? 'bg-white' : 'bg-accent'
                  }`}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
