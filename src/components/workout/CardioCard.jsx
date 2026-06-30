import { formatDuration } from '../../lib/dateUtils'

function formatDistance(distance_m, unit) {
  if (distance_m == null) return null
  const u = unit || 'm'
  if (u === 'min') return null
  if (u === 'km') return `${(distance_m / 1000).toFixed(2)} km`
  if (u === 'mi') return `${(distance_m / 1609.344).toFixed(2)} mi`
  return `${Number(distance_m).toLocaleString()} ${u}`
}

function Field({ label, value }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-2.5 text-center flex-1 min-w-0">
      <p className="text-sm font-bold text-blue-400 leading-none">{value}</p>
      <p className="text-[10px] text-zinc-600 uppercase tracking-wider mt-1">{label}</p>
    </div>
  )
}

export default function CardioCard({ exercise, onDelete, onEdit, readOnly }) {
  const e = exercise.cardio_entry

  const fields = []
  if (e) {
    fields.push(<Field key="dur" label="Duration" value={formatDuration(e.duration_sec)} />)
    const distLabel = formatDistance(e.distance_m, e.distance_unit)
    if (distLabel != null)
      fields.push(<Field key="dist" label="Distance" value={distLabel} />)
    if (e.avg_pace_sec != null)
      fields.push(<Field key="pace" label="Pace" value={formatDuration(e.avg_pace_sec) + ' /500'} />)
    if (e.calories != null)
      fields.push(<Field key="cal" label="Calories" value={`${e.calories} kcal`} />)
    if (e.resistance_level)
      fields.push(<Field key="lvl" label="Level" value={e.resistance_level} />)
  }

  return (
    <div className="bg-card border border-blue-500/20 rounded-2xl p-4 mb-3 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-condensed font-bold text-white uppercase tracking-wide text-lg leading-none">
            {exercise.name}
          </h3>
          <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider bg-blue-500/10 border border-blue-500/20 rounded-full px-2 py-0.5">
            cardio
          </span>
        </div>
        {!readOnly && (
          <div className="flex gap-1">
            {onEdit && (
              <button
                onClick={() => onEdit(exercise)}
                className="text-zinc-700 hover:text-blue-400 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828L7 13.828 3 14l.172-4L13.586 3.586z" />
                </svg>
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(exercise.id)}
                className="text-zinc-700 hover:text-red-400 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
                  <polyline points="3 6 5 6 17 6" /><path d="M8 6V4h4v2" />
                  <path d="M5 6l1 11h8l1-11" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
      {fields.length > 0 ? (
        <div className="flex gap-2 flex-wrap">{fields}</div>
      ) : (
        <p className="text-zinc-600 text-sm">No data logged.</p>
      )}
    </div>
  )
}
