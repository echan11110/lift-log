import { useState } from 'react'
import { formatDuration } from '../../lib/dateUtils'

const ACTIVITIES = ['Rowing', 'Bike', 'Treadmill', 'Elliptical', 'Swimming', 'Ski Erg', 'Assault Bike']

const ALL_FIELDS = [
  { key: 'distance',   label: 'Distance',          hint: 'meters',          required: false },
  { key: 'pace',       label: 'Avg pace',           hint: 'auto-calculated', required: false },
  { key: 'calories',   label: 'Calories',           hint: 'kcal',            required: false },
  { key: 'resistance', label: 'Level / resistance', hint: 'e.g. level 8',   required: false },
]

const DEFAULT_ENABLED = { distance: true, pace: true, calories: false, resistance: false }

export default function CardioEntryForm({ onSave, onCancel, saving, error = null, initialActivity = null }) {
  const isKnown = initialActivity && ACTIVITIES.includes(initialActivity)
  const [activity, setActivity] = useState(isKnown ? initialActivity : ACTIVITIES[0])
  const [customActivity, setCustomActivity] = useState(!isKnown && initialActivity ? initialActivity : '')
  const [addingCustom, setAddingCustom] = useState(!isKnown && !!initialActivity)
  const [durationMin, setDurationMin] = useState('')
  const [durationSec, setDurationSec] = useState('')
  const [distanceM, setDistanceM] = useState('')
  const [calories, setCalories] = useState('')
  const [resistance, setResistance] = useState('')
  const [enabled, setEnabled] = useState(DEFAULT_ENABLED)

  const name = addingCustom ? customActivity.trim() : activity
  const totalSec = (parseInt(durationMin) || 0) * 60 + (parseInt(durationSec) || 0)

  const avgPaceSec = enabled.pace && distanceM && totalSec
    ? Math.round((totalSec / Number(distanceM)) * 500)
    : null

  function toggle(key) {
    setEnabled(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function handleSave() {
    if (!totalSec || !name) return
    const data = {
      duration_sec: totalSec,
      distance_m: enabled.distance && distanceM ? Number(distanceM) : null,
      avg_pace_sec: avgPaceSec,
      calories: enabled.calories && calories ? Number(calories) : null,
      resistance_level: enabled.resistance && resistance ? resistance : null,
    }
    onSave(name, data)
  }

  const canSave = name && totalSec > 0

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={onCancel}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-card border border-border text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >←</button>
        <h2 className="font-condensed font-bold text-white uppercase tracking-wide leading-none" style={{ fontSize: '1.5rem' }}>
          Log Cardio
        </h2>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 mb-3">
        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Activity</p>
        {addingCustom ? (
          <div className="flex gap-2 mb-3">
            <input
              autoFocus
              value={customActivity}
              onChange={e => setCustomActivity(e.target.value)}
              placeholder="Activity name…"
              className="flex-1 bg-surface border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-accent transition-colors"
            />
            <button onClick={() => setAddingCustom(false)} className="text-zinc-500 hover:text-white text-sm px-3 cursor-pointer">Cancel</button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 mb-3">
            {ACTIVITIES.map(a => (
              <button
                key={a}
                onClick={() => setActivity(a)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                  activity === a
                    ? 'bg-blue-500/15 border-blue-500/40 text-blue-400'
                    : 'bg-transparent border-border text-zinc-600 hover:text-zinc-300 hover:border-zinc-600'
                }`}
              >{a}</button>
            ))}
            <button
              onClick={() => setAddingCustom(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider border border-dashed border-zinc-700 text-zinc-600 hover:text-zinc-400 cursor-pointer"
            >+ Custom</button>
          </div>
        )}

        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
          Duration <span className="text-red-400 normal-case font-normal">required</span>
        </p>
        <div className="flex gap-2 items-center mb-4">
          <input
            type="number"
            value={durationMin}
            onChange={e => setDurationMin(e.target.value)}
            placeholder="0"
            className="w-16 bg-surface border border-border rounded-xl px-2 py-2 text-white text-sm text-center focus:outline-none focus:border-accent transition-colors"
          />
          <span className="text-zinc-600 text-sm">min</span>
          <input
            type="number"
            value={durationSec}
            onChange={e => setDurationSec(e.target.value)}
            placeholder="00"
            min="0" max="59"
            className="w-16 bg-surface border border-border rounded-xl px-2 py-2 text-white text-sm text-center focus:outline-none focus:border-accent transition-colors"
          />
          <span className="text-zinc-600 text-sm">sec</span>
        </div>

        {enabled.distance && (
          <>
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Distance</p>
            <div className="flex gap-2 items-center mb-4">
              <input
                type="number"
                value={distanceM}
                onChange={e => setDistanceM(e.target.value)}
                placeholder="0"
                className="w-24 bg-surface border border-border rounded-xl px-3 py-2 text-white text-sm text-center focus:outline-none focus:border-accent transition-colors"
              />
              <span className="text-zinc-600 text-sm">meters</span>
            </div>
          </>
        )}

        {enabled.calories && (
          <>
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Calories</p>
            <div className="flex gap-2 items-center mb-4">
              <input
                type="number"
                value={calories}
                onChange={e => setCalories(e.target.value)}
                placeholder="0"
                className="w-24 bg-surface border border-border rounded-xl px-3 py-2 text-white text-sm text-center focus:outline-none focus:border-accent transition-colors"
              />
              <span className="text-zinc-600 text-sm">kcal</span>
            </div>
          </>
        )}

        {enabled.resistance && (
          <>
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Level / resistance</p>
            <div className="flex gap-2 items-center mb-4">
              <input
                type="text"
                value={resistance}
                onChange={e => setResistance(e.target.value)}
                placeholder="e.g. Level 8"
                className="w-32 bg-surface border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-accent transition-colors"
              />
            </div>
          </>
        )}

        {/* Live preview */}
        {totalSec > 0 && (
          <div className="bg-surface border border-blue-500/20 rounded-xl p-3 flex gap-2 flex-wrap">
            <div className="text-center flex-1 min-w-0">
              <p className="text-sm font-bold text-blue-400">{formatDuration(totalSec)}</p>
              <p className="text-[9px] text-zinc-600 uppercase tracking-wider mt-0.5">Duration</p>
            </div>
            {enabled.distance && distanceM && (
              <div className="text-center flex-1 min-w-0">
                <p className="text-sm font-bold text-blue-400">{Number(distanceM).toLocaleString()} m</p>
                <p className="text-[9px] text-zinc-600 uppercase tracking-wider mt-0.5">Distance</p>
              </div>
            )}
            {enabled.pace && avgPaceSec != null && (
              <div className="text-center flex-1 min-w-0">
                <p className="text-sm font-bold text-blue-400">{formatDuration(avgPaceSec)} /500</p>
                <p className="text-[9px] text-zinc-600 uppercase tracking-wider mt-0.5">Pace</p>
              </div>
            )}
            {enabled.calories && calories && (
              <div className="text-center flex-1 min-w-0">
                <p className="text-sm font-bold text-blue-400">{calories} kcal</p>
                <p className="text-[9px] text-zinc-600 uppercase tracking-wider mt-0.5">Calories</p>
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="text-red-400 text-sm text-center mb-3">{error}</p>
      )}
      <button
        onClick={handleSave}
        disabled={!canSave || saving}
        className="w-full py-3.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 font-condensed font-bold uppercase tracking-wider rounded-2xl text-base hover:bg-blue-500/20 disabled:opacity-40 transition-colors cursor-pointer mb-4"
      >
        {saving ? 'Saving…' : 'Save cardio'}
      </button>

      {/* Field settings */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Field settings</p>
        <p className="text-[10px] text-zinc-700">Customise what you track</p>
      </div>
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border opacity-40">
          <div>
            <p className="text-sm font-semibold text-white">Duration</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">mm:ss</p>
          </div>
          <span className="text-[10px] text-zinc-600">always on</span>
        </div>
        {ALL_FIELDS.map(f => (
          <div key={f.key} className="flex items-center justify-between px-4 py-3 border-b border-border last:border-b-0">
            <div>
              <p className="text-sm font-semibold text-white">{f.label}</p>
              <p className="text-[10px] text-zinc-600 mt-0.5">{f.hint}</p>
            </div>
            <button
              onClick={() => toggle(f.key)}
              className={`w-10 h-6 rounded-full relative transition-colors cursor-pointer border-0 ${
                enabled[f.key] ? 'bg-blue-500/60' : 'bg-zinc-700'
              }`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${
                enabled[f.key] ? 'left-[18px]' : 'left-0.5'
              }`} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
