import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceDot, Cell,
} from 'recharts'
import { PageSpinner } from '../components/ui/Spinner'
import { shortDate } from '../lib/dateUtils'

export default function ProgressView() {
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
    const { data } = await supabase
      .from('exercises')
      .select('name, workout_sessions!inner(user_id, date)')
      .eq('workout_sessions.user_id', user.id)
    if (data) {
      const unique = [...new Map(data.map(r => [r.name, r])).values()]
        .map(r => r.name)
        .sort()
      setExercises(unique)
    }
    setLoading(false)
  }

  async function loadProgress(name) {
    setChartLoading(true)
    setSelected(name)
    const { data: { user } } = await supabase.auth.getUser()

    const { data: exData } = await supabase
      .from('exercises')
      .select('id, workout_sessions!inner(date, user_id)')
      .eq('name', name)
      .eq('workout_sessions.user_id', user.id)
      .order('workout_sessions(date)')

    if (!exData?.length) { setData([]); setChartLoading(false); return }

    const rows = []
    let allTimePR = 0

    for (const ex of exData) {
      const date = ex.workout_sessions?.date
      const { data: sets } = await supabase
        .from('sets')
        .select('*, dropsets(*)')
        .eq('exercise_id', ex.id)

      if (!sets?.length) continue

      let maxWeight = 0
      let volume = 0
      for (const s of sets) {
        maxWeight = Math.max(maxWeight, s.weight)
        volume += s.weight * s.reps
        for (const d of (s.dropsets ?? [])) {
          volume += d.weight * d.reps
        }
      }

      const isPR = maxWeight > allTimePR
      if (isPR) allTimePR = maxWeight

      rows.push({ date, maxWeight, volume, isPR: false, displayDate: shortDate(date) })
    }

    let runningPR = 0
    rows.forEach(r => {
      if (r.maxWeight > runningPR) {
        runningPR = r.maxWeight
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
  const allTimePR = data.length ? Math.max(...data.map(d => d.maxWeight)) : 0
  const totalVolume = data.reduce((t, d) => t + d.volume, 0)

  if (loading) return <PageSpinner />

  return (
    <div>
      {!selected ? (
        <>
          <h2 className="text-white font-bold text-xl mb-4">Progress</h2>
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
                  className="w-full text-left bg-card border border-border rounded-xl px-4 py-3.5 text-white hover:border-accent/50 transition-colors"
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
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-card border border-border text-zinc-400 hover:text-white transition-colors"
            >←</button>
            <h2 className="text-white font-bold text-lg truncate">{selected}</h2>
          </div>

          {chartLoading ? <PageSpinner /> : (
            <>
              <div className="grid grid-cols-3 gap-3 mb-5">
                <Stat label="All-time PR" value={`${allTimePR} lbs`} accent />
                <Stat label="Sessions" value={data.length} />
                <Stat label="Total Volume" value={`${(totalVolume / 1000).toFixed(1)}k lbs`} />
              </div>

              {data.length > 0 && (
                <>
                  <ChartCard title="Max Weight per Session">
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                        <XAxis dataKey="displayDate" tick={{ fill: '#71717a', fontSize: 10 }} interval="preserveStartEnd" />
                        <YAxis tick={{ fill: '#71717a', fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8 }}
                          labelStyle={{ color: '#fff', fontSize: 12 }}
                          itemStyle={{ color: '#60a5fa' }}
                          formatter={v => [`${v} lbs`]}
                        />
                        <Line type="monotone" dataKey="maxWeight" stroke="#3b82f6" strokeWidth={2} dot={false} />
                        {data.map((d, i) => d.isPR && (
                          <ReferenceDot key={i} x={d.displayDate} y={d.maxWeight} r={5} fill="#f59e0b" stroke="none" />
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
                          contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8 }}
                          labelStyle={{ color: '#fff', fontSize: 12 }}
                          itemStyle={{ color: '#60a5fa' }}
                          formatter={v => [`${v.toLocaleString()} lbs`]}
                        />
                        <Bar dataKey="volume" radius={[3, 3, 0, 0]}>
                          {data.map((d, i) => <Cell key={i} fill={d.isPR ? '#f59e0b' : '#3b82f6'} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  {prs.length > 0 && (
                    <div className="bg-card border border-border rounded-2xl p-4 mt-4">
                      <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                        <span>PRs</span>
                        <span className="text-amber-400">★</span>
                      </h3>
                      <div className="space-y-2">
                        {[...prs].reverse().map((pr, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <span className="text-zinc-400 text-sm">{pr.date}</span>
                            <span className="text-amber-400 font-semibold text-sm">{pr.maxWeight} lbs</span>
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

function Stat({ label, value, accent }) {
  return (
    <div className="bg-card border border-border rounded-xl p-3 text-center">
      <p className="text-zinc-500 text-xs mb-0.5">{label}</p>
      <p className={`font-bold text-sm ${accent ? 'text-accent' : 'text-white'}`}>{value}</p>
    </div>
  )
}

function ChartCard({ title, children }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 mb-3">
      <p className="text-zinc-400 text-xs font-medium mb-3">{title}</p>
      {children}
    </div>
  )
}
