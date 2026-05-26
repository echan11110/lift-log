import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { weekRange, displayDate, todayStr, sessionVolume, DAY_LABELS } from '../lib/dateUtils'
import SplitBadge from '../components/ui/SplitBadge'
import ExerciseCard from '../components/workout/ExerciseCard'
import { PageSpinner } from '../components/ui/Spinner'

export default function WeeklyView() {
  const [anchor, setAnchor] = useState(todayStr())
  const [sessions, setSessions] = useState({})
  const [exerciseMap, setExerciseMap] = useState({})
  const [expanded, setExpanded] = useState(null)
  const [loading, setLoading] = useState(true)

  const days = weekRange(anchor)

  useEffect(() => {
    loadWeek()
  }, [anchor])

  async function loadWeek() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: sessionData } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', days[0])
        .lte('date', days[6])

      const map = {}
      sessionData?.forEach(s => { map[s.date] = s })
      setSessions(map)

      if (sessionData?.length) {
        const ids = sessionData.map(s => s.id)
        const { data: exData } = await supabase
          .from('exercises')
          .select('*, sets(*, dropsets(*))')
          .in('session_id', ids)
          .order('exercise_order')

        const exMap = {}
        exData?.forEach(ex => {
          if (!exMap[ex.session_id]) exMap[ex.session_id] = []
          exMap[ex.session_id].push({
            ...ex,
            sets: (ex.sets ?? [])
              .sort((a, b) => a.set_number - b.set_number)
              .map(s => ({ ...s, dropsets: (s.dropsets ?? []).sort((a, b) => a.drop_order - b.drop_order) })),
          })
        })
        setExerciseMap(exMap)
      } else {
        setExerciseMap({})
      }
    } finally {
      setLoading(false)
    }
  }

  function prevWeek() {
    const d = new Date(anchor + 'T12:00:00')
    d.setDate(d.getDate() - 7)
    setAnchor(d.toISOString().slice(0, 10))
    setExpanded(null)
  }

  function nextWeek() {
    const d = new Date(anchor + 'T12:00:00')
    d.setDate(d.getDate() + 7)
    const next = d.toISOString().slice(0, 10)
    const weekStart = weekRange(next)[0]
    if (weekStart <= todayStr()) {
      setAnchor(next)
      setExpanded(null)
    }
  }

  const weekLabel = `${formatShort(days[0])} – ${formatShort(days[6])}`

  if (loading) return <PageSpinner />

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <button onClick={prevWeek} className="w-10 h-10 flex items-center justify-center rounded-xl bg-card border border-border text-zinc-400 hover:text-white transition-colors">←</button>
        <p className="text-white font-bold">{weekLabel}</p>
        <button onClick={nextWeek} className="w-10 h-10 flex items-center justify-center rounded-xl bg-card border border-border text-zinc-400 hover:text-white transition-colors">→</button>
      </div>

      <div className="space-y-2">
        {days.map((dateStr, i) => {
          const session = sessions[dateStr]
          const exercises = session ? (exerciseMap[session.id] ?? []) : []
          const volume = sessionVolume(exercises)
          const isExpanded = expanded === dateStr
          const dayLabel = DAY_LABELS()[i]
          const dayNum = new Date(dateStr + 'T12:00:00').getDate()
          const isFuture = dateStr > todayStr()

          return (
            <div key={dateStr} className={`bg-card border rounded-2xl overflow-hidden transition-all ${isFuture ? 'opacity-40' : 'border-border'}`}>
              <button
                onClick={() => !isFuture && session && setExpanded(isExpanded ? null : dateStr)}
                className="w-full flex items-center gap-3 p-3.5 text-left"
                disabled={isFuture || !session}
              >
                <div className="w-12 text-center">
                  <p className="text-zinc-500 text-xs">{dayLabel}</p>
                  <p className={`text-lg font-bold ${dateStr === todayStr() ? 'text-accent' : 'text-white'}`}>{dayNum}</p>
                </div>
                {session ? (
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <SplitBadge split={session.split_type} />
                    </div>
                    <p className="text-zinc-500 text-xs">{exercises.length} exercises · {volume.toLocaleString()} lbs</p>
                  </div>
                ) : (
                  <p className="text-zinc-700 text-sm flex-1">{isFuture ? '—' : 'Rest day'}</p>
                )}
                {session && (
                  <span className="text-zinc-600 text-xs">{isExpanded ? '▲' : '▼'}</span>
                )}
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-border">
                  <div className="pt-4 space-y-1">
                    {exercises.map(ex => (
                      <ExerciseCard key={ex.id} exercise={ex} readOnly />
                    ))}
                  </div>
                  {session?.notes && (
                    <p className="text-zinc-500 text-sm mt-3 italic">{session.notes}</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatShort(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
