import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceDot, Cell,
} from 'recharts'
import { PageSpinner } from '../components/ui/Spinner'
import { shortDate } from '../lib/dateUtils'
import { epley1RM, bestE1RM } from '../lib/strength'

export default function ProgressView() {
  const [progressTab, setProgressTab] = useState('strength')
  const [exercises, setExercises] = useState([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [chartLoading, setChartLoading] = useState(false)

  useEffect(() => {
    loadExercises()
  }, [])

  async function loadExercises() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.rpc('distinct_exercise_names', { p_user_id: user.id })
    if (data) setExercises(data)
    setLoading(false)
  }

  async function loadProgress(name) {
    setChartLoading(true)
    setSelected(name)
    const { data: { user } } = await supabase.auth.getUser()

    const { data: exData } = await supabase
      .from('exercises')
      .select('id, workout_sessions!inner(date, user_id), sets(weight, reps, set_number, dropsets(weight, reps))')
      .eq('name', name)
      .eq('workout_sessions.user_id', user.id)
      .order('workout_sessions(date)')

    if (!exData?.length) { setData([]); setChartLoading(false); return }

    const rows = []

    for (const ex of exData) {
      const date = ex.workout_sessions?.date
      const sets = ex.sets ?? []

      if (!sets.length) continue

      // e1RM from main sets only (no dropsets)
      const { e1rm, set: prSet } = bestE1RM(sets)

      let maxWeight = 0
      let volume = 0
      for (const s of sets) {
        if (s.weight > maxWeight) maxWeight = s.weight
        volume += s.weight * s.reps
        for (const d of (s.dropsets ?? [])) volume += d.weight * d.reps
      }

      rows.push({ date, e1rm, prSet, maxWeight, volume, isPR: false, displayDate: shortDate(date) })
    }

    // PR detection keyed off e1RM so same-weight/more-reps sessions register
    let runningPR = 0
    rows.forEach(r => {
      if (r.e1rm > runningPR) {
        runningPR = r.e1rm
        r.isPR = true
      }
    })

    setData(rows)
    setChartLoading(false)
  }

  const filtered = query
    ? exercises.filter(n => n.toLowerCase().includes(query.toLowerCase()))
    : exercises

  const prs = data.filter(d => d.isPR)
  const bestAllTimeE1RM = data.length ? Math.max(...data.map(d => d.e1rm)) : 0
  const allTimeMaxWeight = data.length ? Math.max(...data.map(d => d.maxWeight)) : 0
  const totalVolume = data.reduce((t, d) => t + d.volume, 0)

  if (loading) return <PageSpinner />

  return (
    <div>
      <h2 className="font-condensed font-bold text-white uppercase tracking-wide mb-4" style={{fontSize:'1.75rem',lineHeight:1}}>Progress</h2>

      {/* Strength / Cardio tab (only on list view) */}
      {!selected && (
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => setProgressTab('strength')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all cursor-pointer ${
              progressTab === 'strength'
                ? 'border-accent/40 bg-accent/15 text-accent'
                : 'border-border text-zinc-600 hover:text-zinc-400'
            }`}
          >Strength</button>
          <button
            onClick={() => setProgressTab('cardio')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all cursor-pointer ${
              progressTab === 'cardio'
                ? 'border-blue-500/40 bg-blue-500/15 text-blue-400'
                : 'border-border text-zinc-600 hover:text-zinc-400'
            }`}
          >Cardio</button>
        </div>
      )}

      {/* Cardio summary pane */}
      {!selected && progressTab === 'cardio' && <CardioProg />}

      {!selected && progressTab === 'strength' ? (
        <>
          <p className="text-[10px] text-zinc-600 text-center mb-3">Cardio activities are excluded from strength PRs and volume</p>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search exercises…"
            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-accent transition-colors mb-4"
          />
          {filtered.length === 0 ? (
            <p className="text-zinc-600 text-center py-12">No exercises logged yet.</p>
          ) : (
            <div className="space-y-2">
              {filtered.map(name => (
                <button
                  key={name}
                  onClick={() => loadProgress(name)}
                  className="w-full text-left bg-card border border-border rounded-xl px-4 py-3.5 font-condensed font-semibold text-white uppercase tracking-wide text-base hover:border-accent/50 hover:bg-cardHov transition-colors cursor-pointer"
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-5">
            <button
              onClick={() => setSelected(null)}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-card border border-border text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >←</button>
            <h2 className="font-condensed font-bold text-white uppercase tracking-wide truncate" style={{fontSize:'1.5rem',lineHeight:1}}>{selected}</h2>
          </div>

          {chartLoading ? <PageSpinner /> : (
            <>
              <div className="grid grid-cols-2 gap-3 mb-5">
                <Stat label="Best e1RM" value={`${Math.round(bestAllTimeE1RM)} lbs`} accent />
                <Stat label="Heaviest" value={`${allTimeMaxWeight} lbs`} />
                <Stat label="Sessions" value={data.length} />
                <Stat label="Total Volume" value={`${(totalVolume / 1000).toFixed(1)}k lbs`} />
              </div>

              {data.length > 0 && (
                <>
                  <ChartCard title="Est. 1RM per Session">
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                        <XAxis dataKey="displayDate" tick={{ fill: '#71717a', fontSize: 10 }} interval="preserveStartEnd" />
                        <YAxis tick={{ fill: '#71717a', fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{ background: '#141414', border: '1px solid #242424', borderRadius: 8 }}
                          labelStyle={{ color: '#fff', fontSize: 12 }}
                          itemStyle={{ color: '#f97316' }}
                          formatter={v => [`${Math.round(v)} lbs`]}
                        />
                        <Line type="monotone" dataKey="e1rm" stroke="#f97316" strokeWidth={2.5} dot={false} />
                        {data.map((d, i) => d.isPR && (
                          <ReferenceDot key={i} x={d.displayDate} y={d.e1rm} r={5} fill="#f59e0b" stroke="none" />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard title="Volume per Session">
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
                        <XAxis dataKey="displayDate" tick={{ fill: '#71717a', fontSize: 10 }} interval="preserveStartEnd" />
                        <YAxis tick={{ fill: '#71717a', fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{ background: '#141414', border: '1px solid #242424', borderRadius: 8 }}
                          labelStyle={{ color: '#fff', fontSize: 12 }}
                          itemStyle={{ color: '#f97316' }}
                          formatter={v => [`${v.toLocaleString()} lbs`]}
                        />
                        <Bar dataKey="volume" radius={[3, 3, 0, 0]}>
                          {data.map((d, i) => <Cell key={i} fill={d.isPR ? '#f59e0b' : '#f97316'} fillOpacity={d.isPR ? 1 : 0.6} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  {prs.length > 0 && (
                    <div className="bg-card border border-border rounded-2xl p-4 mt-4">
                      <h3 className="font-condensed font-bold text-white uppercase tracking-wide mb-3 flex items-center gap-2 text-lg">
                        <span className="text-amber-400">★</span>
                        <span>Personal Records</span>
                      </h3>
                      <div className="space-y-2">
                        {[...prs].reverse().map((pr, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <span className="text-zinc-400 text-sm">{pr.date}</span>
                            <span className="text-amber-400 font-semibold text-sm">
                              {pr.prSet.weight}×{pr.prSet.reps} — e1RM {Math.round(pr.e1rm)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {data.length === 0 && (
                <p className="text-zinc-600 text-center py-12">No data for {selected} yet.</p>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

function CardioProg() {
  const [cardioData, setCardioData] = useState([])
  const [loadingCardio, setLoadingCardio] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('exercises')
        .select('name, cardio_entries(*), workout_sessions!inner(date, user_id)')
        .eq('workout_sessions.user_id', user.id)
        .eq('exercise_type', 'cardio')
        .order('workout_sessions(date)', { ascending: false })
      setCardioData(data ?? [])
      setLoadingCardio(false)
    }
    load()
  }, [])

  if (loadingCardio) return <PageSpinner />

  if (!cardioData.length) return (
    <p className="text-zinc-600 text-center py-12">No cardio logged yet.</p>
  )

  const byActivity = {}
  cardioData.forEach(ex => {
    const entry = (ex.cardio_entries ?? [])[0]
    if (!entry) return
    if (!byActivity[ex.name]) byActivity[ex.name] = { sessions: 0, totalSec: 0, totalDist: 0 }
    byActivity[ex.name].sessions++
    byActivity[ex.name].totalSec += entry.duration_sec ?? 0
    byActivity[ex.name].totalDist += entry.distance_m ?? 0
  })

  return (
    <div>
      {Object.entries(byActivity).map(([name, stats]) => {
        const hrs = Math.floor(stats.totalSec / 3600)
        const mins = Math.floor((stats.totalSec % 3600) / 60)
        const timeLabel = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`
        return (
          <div key={name} className="bg-card border border-blue-500/20 rounded-2xl p-4 mb-3">
            <p className="font-condensed font-bold text-white uppercase tracking-wide text-lg mb-3">{name}</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-surface border border-border rounded-xl p-2.5 text-center">
                <p className="text-sm font-bold text-blue-400">{stats.sessions}</p>
                <p className="text-[9px] text-zinc-600 uppercase tracking-wider mt-1">Sessions</p>
              </div>
              <div className="bg-surface border border-border rounded-xl p-2.5 text-center">
                <p className="text-sm font-bold text-blue-400">{timeLabel}</p>
                <p className="text-[9px] text-zinc-600 uppercase tracking-wider mt-1">Total time</p>
              </div>
              {stats.totalDist > 0 && (
                <div className="bg-surface border border-border rounded-xl p-2.5 text-center">
                  <p className="text-sm font-bold text-blue-400">{(stats.totalDist / 1000).toFixed(1)} km</p>
                  <p className="text-[9px] text-zinc-600 uppercase tracking-wider mt-1">Total dist.</p>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Stat({ label, value, accent }) {
  return (
    <div className={`rounded-xl p-3 text-center border ${accent ? 'bg-accent/10 border-accent/20' : 'bg-card border-border'}`}>
      <p className="text-zinc-500 text-[10px] font-medium uppercase tracking-wider mb-1">{label}</p>
      <p className={`font-condensed font-bold text-lg leading-none ${accent ? 'text-accent' : 'text-white'}`}>{value}</p>
    </div>
  )
}

function ChartCard({ title, children }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 mb-3">
      <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-3">{title}</p>
      {children}
    </div>
  )
}
