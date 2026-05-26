import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { monthDays, todayStr, toDateStr, sessionVolume } from '../lib/dateUtils'
import SplitBadge, { splitColor } from '../components/ui/SplitBadge'
import ExerciseCard from '../components/workout/ExerciseCard'
import { PageSpinner } from '../components/ui/Spinner'

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DOW = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

export default function MonthlyView() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [sessions, setSessions] = useState({})
  const [modal, setModal] = useState(null)
  const [modalData, setModalData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modalLoading, setModalLoading] = useState(false)

  const days = monthDays(year, month)

  useEffect(() => {
    loadMonth()
  }, [year, month])

  async function loadMonth() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const firstDay = `${year}-${String(month + 1).padStart(2, '0')}-01`
      const lastDay = toDateStr(new Date(year, month + 1, 0))

      const { data } = await supabase
        .from('workout_sessions')
        .select('id, date, split_type')
        .eq('user_id', user.id)
        .gte('date', firstDay)
        .lte('date', lastDay)

      const map = {}
      data?.forEach(s => { map[s.date] = s })
      setSessions(map)
    } finally {
      setLoading(false)
    }
  }

  async function openModal(session) {
    setModal(session)
    setModalLoading(true)
    const { data: exData } = await supabase
      .from('exercises')
      .select('*, sets(*, dropsets(*))')
      .eq('session_id', session.id)
      .order('exercise_order')
    const exercises = (exData ?? []).map(ex => ({
      ...ex,
      sets: (ex.sets ?? [])
        .sort((a, b) => a.set_number - b.set_number)
        .map(s => ({ ...s, dropsets: (s.dropsets ?? []).sort((a, b) => a.drop_order - b.drop_order) })),
    }))
    setModalData(exercises)
    setModalLoading(false)
  }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    const nextDate = new Date(year, month + 1, 1)
    if (nextDate <= new Date()) {
      if (month === 11) { setYear(y => y + 1); setMonth(0) }
      else setMonth(m => m + 1)
    }
  }

  if (loading) return <PageSpinner />

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <button onClick={prevMonth} className="w-10 h-10 flex items-center justify-center rounded-xl bg-card border border-border text-zinc-400 hover:text-white transition-colors">←</button>
        <p className="text-white font-bold">{MONTH_NAMES[month]} {year}</p>
        <button onClick={nextMonth} className="w-10 h-10 flex items-center justify-center rounded-xl bg-card border border-border text-zinc-400 hover:text-white transition-colors">→</button>
      </div>

      <div className="grid grid-cols-7 gap-px bg-border rounded-t-xl overflow-hidden mb-px">
        {DOW.map(d => (
          <div key={d} className="bg-card text-center py-2 text-xs text-zinc-600 font-medium">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px bg-border rounded-b-xl overflow-hidden">
        {days.map(({ dateStr, thisMonth }) => {
          const session = sessions[dateStr]
          const today = dateStr === todayStr()
          const future = dateStr > todayStr()
          const c = session ? splitColor(session.split_type) : null

          return (
            <button
              key={dateStr}
              onClick={() => session && openModal(session)}
              disabled={!session}
              className={`bg-card aspect-square flex flex-col items-center justify-center relative transition-colors ${
                session ? 'hover:bg-zinc-800 cursor-pointer' : 'cursor-default'
              } ${!thisMonth ? 'opacity-30' : ''}`}
            >
              <span className={`text-xs font-medium ${today ? 'text-accent' : future ? 'text-zinc-700' : 'text-zinc-300'}`}>
                {new Date(dateStr + 'T12:00:00').getDate()}
              </span>
              {session && c && (
                <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${c.dot}`} />
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {['Push','Pull','Legs','Arms'].map(s => {
          const c = splitColor(s)
          return (
            <span key={s} className={`flex items-center gap-1.5 text-xs ${c.text}`}>
              <span className={`w-2 h-2 rounded-full ${c.dot}`} />{s}
            </span>
          )
        })}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70" onClick={() => setModal(null)}>
          <div
            className="bg-card border-t border-border rounded-t-3xl w-full max-w-lg max-h-[80dvh] overflow-y-auto p-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-white font-bold">{formatModalDate(modal.date)}</p>
                <SplitBadge split={modal.split_type} />
              </div>
              <button onClick={() => setModal(null)} className="w-9 h-9 rounded-full bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center text-lg">×</button>
            </div>

            {modalLoading ? (
              <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
            ) : (
              modalData?.map(ex => (
                <ExerciseCard key={ex.id} exercise={ex} readOnly />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function formatModalDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}
