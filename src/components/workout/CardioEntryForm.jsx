import { useState } from 'react'
import { formatDuration } from '../../lib/dateUtils'

// Common unit presets shown as quick-pick chips.
// User can always type anything custom — these are just shortcuts.
const UNIT_PRESETS = [
  { value: 'm',      label: 'meters' },
  { value: 'km',     label: 'kilometers' },
  { value: 'mi',     label: 'miles' },
  { value: 'steps',  label: 'steps' },
  { value: 'floors', label: 'floors' },
  { value: 'min',    label: 'duration only' },
]

const PRESET_VALUES = new Set(UNIT_PRESETS.map(p => p.value))

function unitDisplayLabel(u) {
  const preset = UNIT_PRESETS.find(p => p.value === u)
  return preset ? preset.label : u
}

// Only km/mi need a conversion from the user's display value to storage meters.
// Everything else is stored as the raw number the user entered.
function toStorageValue(displayVal, unit) {
  const n = Number(displayVal)
  if (!n) return null
  if (unit === 'km') return n * 1000
  if (unit === 'mi') return n * 1609.344
  return n
}

function toDisplayValue(storageVal, unit) {
  if (storageVal == null) return ''
  if (unit === 'km') return (storageVal / 1000).toFixed(2)
  if (unit === 'mi') return (storageVal / 1609.344).toFixed(2)
  return String(Math.round(storageVal))
}

// Shared chip-picker + custom text input for choosing a unit.
// Shows preset buttons then a "+ Custom" chip that reveals a text field.
function UnitPicker({ value, onChange }) {
  const isCustom = value && !PRESET_VALUES.has(value) && value !== ''
  const [enteringCustom, setEnteringCustom] = useState(isCustom)
  const [customText, setCustomText] = useState(isCustom ? value : '')

  function selectPreset(v) {
    setEnteringCustom(false)
    setCustomText('')
    onChange(v)
  }

  function confirmCustom(text) {
    const t = text.trim()
    if (t) onChange(t)
    setEnteringCustom(false)
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {UNIT_PRESETS.map(p => (
          <button
            key={p.value}
            type="button"
            onClick={() => selectPreset(p.value)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all cursor-pointer ${
              value === p.value && !enteringCustom
                ? 'bg-blue-500/15 border-blue-500/40 text-blue-400'
                : 'bg-transparent border-border text-zinc-600 hover:text-zinc-300 hover:border-zinc-600'
            }`}
          >{p.label}</button>
        ))}
        <button
          type="button"
          onClick={() => { setEnteringCustom(true); setCustomText(isCustom ? value : '') }}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all cursor-pointer ${
            isCustom && !enteringCustom
              ? 'bg-blue-500/15 border-blue-500/40 text-blue-400'
              : 'border-dashed border-zinc-700 text-zinc-600 hover:text-zinc-400'
          }`}
        >{isCustom && !enteringCustom ? value : '+ Custom'}</button>
      </div>

      {enteringCustom && (
        <div className="flex gap-2 mt-1">
          <input
            autoFocus
            value={customText}
            onChange={e => setCustomText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); confirmCustom(customText) }
              if (e.key === 'Escape') setEnteringCustom(false)
            }}
            placeholder="e.g. flights, calories…"
            className="flex-1 bg-surface border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/60 transition-colors"
          />
          <button
            type="button"
            onClick={() => confirmCustom(customText)}
            disabled={!customText.trim()}
            className="px-3 py-2 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold rounded-xl disabled:opacity-40 cursor-pointer"
          >Set</button>
          <button
            type="button"
            onClick={() => setEnteringCustom(false)}
            className="text-zinc-500 hover:text-white text-xs px-2 cursor-pointer"
          >Cancel</button>
        </div>
      )}
    </div>
  )
}

export default function CardioEntryForm({
  defs = [],
  onSave,
  onUpdate,
  onAddDef,
  onCancel,
  saving,
  error = null,
  initialActivity = null,
  initialValues = null,
}) {
  const isEdit = !!initialValues
  const allDefNames = defs.map(d => d.name)

  function getInitialActivity() {
    if (initialValues?.name) return initialValues.name
    if (initialActivity) return initialActivity
    return defs[0]?.name ?? ''
  }

  function getInitialUnit() {
    if (initialValues?.distance_unit) return initialValues.distance_unit
    const name = getInitialActivity()
    return defs.find(d => d.name === name)?.unit ?? 'm'
  }

  const [activity, setActivity] = useState(getInitialActivity)
  const [unit, setUnit] = useState(getInitialUnit)

  // "+ Add exercise" panel state
  const [addingDef, setAddingDef] = useState(false)
  const [newDefName, setNewDefName] = useState('')
  const [newDefUnit, setNewDefUnit] = useState('m')
  const [savingDef, setSavingDef] = useState(false)
  const [defError, setDefError] = useState(null)

  // Duration
  const initMin = initialValues ? String(Math.floor(initialValues.duration_sec / 60) || '') : ''
  const initSec = initialValues ? String(initialValues.duration_sec % 60 || '') : ''
  const [durationMin, setDurationMin] = useState(initMin)
  const [durationSec, setDurationSec] = useState(initSec)

  // Distance display value — derived from stored value + current unit
  const [distanceDisplay, setDistanceDisplay] = useState(
    initialValues?.distance_m != null ? toDisplayValue(initialValues.distance_m, getInitialUnit()) : ''
  )

  const [calories, setCalories] = useState(initialValues?.calories ? String(initialValues.calories) : '')
  const [resistance, setResistance] = useState(initialValues?.resistance_level ?? '')
  const [showCalories, setShowCalories] = useState(!!initialValues?.calories)
  const [showResistance, setShowResistance] = useState(!!initialValues?.resistance_level)

  const hasDistance = unit !== 'min'
  const totalSec = (parseInt(durationMin) || 0) * 60 + (parseInt(durationSec) || 0)
  const distanceStorage = hasDistance && distanceDisplay ? toStorageValue(distanceDisplay, unit) : null
  // Pace only makes sense for meters (rowing pace is per 500m)
  const avgPaceSec = unit === 'm' && distanceStorage && totalSec
    ? Math.round((totalSec / distanceStorage) * 500)
    : null

  function handleActivityChange(name) {
    setActivity(name)
    // When switching activity, adopt that activity's default unit (if known)
    const defUnit = defs.find(d => d.name === name)?.unit
    if (defUnit) setUnit(defUnit)
    setDistanceDisplay('')
  }

  async function handleAddDef() {
    if (!newDefName.trim()) return
    setSavingDef(true)
    setDefError(null)
    try {
      await onAddDef(newDefName.trim(), newDefUnit)
      setActivity(newDefName.trim())
      setUnit(newDefUnit)
      setDistanceDisplay('')
      setAddingDef(false)
      setNewDefName('')
      setNewDefUnit('m')
    } catch (err) {
      setDefError(err.message)
    } finally {
      setSavingDef(false)
    }
  }

  function handleSave() {
    if (!totalSec || !activity) return
    const data = {
      duration_sec: totalSec,
      distance_m: distanceStorage,
      distance_unit: hasDistance && distanceStorage ? unit : null,
      avg_pace_sec: avgPaceSec,
      calories: showCalories && calories ? Number(calories) : null,
      resistance_level: showResistance && resistance ? resistance : null,
    }
    if (isEdit) onUpdate(activity, data)
    else onSave(activity, data)
  }

  const canSave = activity && totalSec > 0
  const systemDefs = defs.filter(d => d.user_id === null)
  const userDefs = defs.filter(d => d.user_id !== null)

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <button
          type="button"
          onClick={onCancel}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-card border border-border text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >←</button>
        <h2 className="font-condensed font-bold text-white uppercase tracking-wide leading-none" style={{ fontSize: '1.5rem' }}>
          {isEdit ? 'Edit Cardio' : 'Log Cardio'}
        </h2>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 mb-3">

        {/* Activity picker */}
        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Activity</p>
        {addingDef ? (
          <div className="mb-4">
            <p className="text-xs text-zinc-500 mb-1.5">Exercise name</p>
            <input
              autoFocus
              value={newDefName}
              onChange={e => setNewDefName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddDef()}
              placeholder="e.g. Jump rope"
              className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-accent transition-colors mb-3"
            />
            <p className="text-xs text-zinc-500 mb-1.5">Default unit for this exercise</p>
            <UnitPicker value={newDefUnit} onChange={setNewDefUnit} />
            {defError && <p className="text-red-400 text-xs mt-2">{defError}</p>}
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={handleAddDef}
                disabled={!newDefName.trim() || savingDef}
                className="flex-1 py-2 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-sm font-semibold rounded-xl disabled:opacity-40 cursor-pointer"
              >{savingDef ? 'Saving…' : 'Add exercise'}</button>
              <button
                type="button"
                onClick={() => { setAddingDef(false); setDefError(null) }}
                className="text-zinc-500 hover:text-white text-sm px-3 cursor-pointer"
              >Cancel</button>
            </div>
          </div>
        ) : (
          <div className="mb-4">
            <div className="flex flex-wrap gap-2 mb-1">
              {[...systemDefs, ...userDefs].map(d => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => handleActivityChange(d.name)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                    activity === d.name
                      ? 'bg-blue-500/15 border-blue-500/40 text-blue-400'
                      : 'bg-transparent border-border text-zinc-600 hover:text-zinc-300 hover:border-zinc-600'
                  }`}
                >{d.name}</button>
              ))}
              <button
                type="button"
                onClick={() => setAddingDef(true)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider border border-dashed border-zinc-700 text-zinc-600 hover:text-zinc-400 cursor-pointer"
              >+ Add exercise</button>
            </div>
          </div>
        )}

        {/* Duration */}
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

        {/* Unit picker — always visible, user can change per-entry */}
        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Unit</p>
        <div className="mb-4">
          <UnitPicker value={unit} onChange={v => { setUnit(v); setDistanceDisplay('') }} />
        </div>

        {/* Distance input (hidden when unit = 'min') */}
        {hasDistance && (
          <>
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Distance</p>
            <div className="flex gap-2 items-center mb-4">
              <input
                type="number"
                value={distanceDisplay}
                onChange={e => setDistanceDisplay(e.target.value)}
                placeholder="0"
                className="w-24 bg-surface border border-border rounded-xl px-3 py-2 text-white text-sm text-center focus:outline-none focus:border-accent transition-colors"
              />
              <span className="text-zinc-600 text-sm">{unitDisplayLabel(unit)}</span>
            </div>
          </>
        )}

        {showCalories && (
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

        {showResistance && (
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
            {hasDistance && distanceDisplay && (
              <div className="text-center flex-1 min-w-0">
                <p className="text-sm font-bold text-blue-400">{Number(distanceDisplay).toLocaleString()} {unit}</p>
                <p className="text-[9px] text-zinc-600 uppercase tracking-wider mt-0.5">Distance</p>
              </div>
            )}
            {avgPaceSec != null && (
              <div className="text-center flex-1 min-w-0">
                <p className="text-sm font-bold text-blue-400">{formatDuration(avgPaceSec)} /500</p>
                <p className="text-[9px] text-zinc-600 uppercase tracking-wider mt-0.5">Pace</p>
              </div>
            )}
            {showCalories && calories && (
              <div className="text-center flex-1 min-w-0">
                <p className="text-sm font-bold text-blue-400">{calories} kcal</p>
                <p className="text-[9px] text-zinc-600 uppercase tracking-wider mt-0.5">Calories</p>
              </div>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-red-400 text-sm text-center mb-3">{error}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={!canSave || saving}
        className="w-full py-3.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 font-condensed font-bold uppercase tracking-wider rounded-2xl text-base hover:bg-blue-500/20 disabled:opacity-40 transition-colors cursor-pointer mb-4"
      >
        {saving ? 'Saving…' : isEdit ? 'Update cardio' : 'Save cardio'}
      </button>

      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Optional fields</p>
      </div>
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border opacity-40">
          <div>
            <p className="text-sm font-semibold text-white">Duration</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">mm:ss</p>
          </div>
          <span className="text-[10px] text-zinc-600">always on</span>
        </div>
        <Toggle label="Calories" hint="kcal" on={showCalories} onToggle={() => setShowCalories(p => !p)} />
        <Toggle label="Level / resistance" hint="e.g. level 8" on={showResistance} onToggle={() => setShowResistance(p => !p)} last />
      </div>
    </div>
  )
}

function Toggle({ label, hint, on, onToggle, last }) {
  return (
    <div className={`flex items-center justify-between px-4 py-3 ${!last ? 'border-b border-border' : ''}`}>
      <div>
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="text-[10px] text-zinc-600 mt-0.5">{hint}</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={`w-10 h-6 rounded-full relative transition-colors cursor-pointer border-0 ${on ? 'bg-blue-500/60' : 'bg-zinc-700'}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
      </button>
    </div>
  )
}
