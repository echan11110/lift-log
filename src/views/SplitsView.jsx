import { useState } from 'react'
import { useSplitTemplates } from '../hooks/useSplitTemplates'
import { PageSpinner } from '../components/ui/Spinner'

const MUSCLE_GROUPS = [
  'chest','back','lats','traps','front_delt','side_delt','rear_delt',
  'biceps','triceps','forearms','quads','hamstrings','glutes','calves','abs',
]

export default function SplitsView() {
  const { templates, loading, duplicateTemplate, createTemplate, deleteTemplate, upsertDay } = useSplitTemplates()
  const [editingDay, setEditingDay] = useState(null) // { templateId, day }
  const [newTemplateName, setNewTemplateName] = useState('')
  const [addingTemplate, setAddingTemplate] = useState(false)

  if (loading) return <PageSpinner />

  const systemTemplates = templates.filter(t => t.user_id === null)
  const userTemplates = templates.filter(t => t.user_id !== null)

  async function handleDuplicate(id) {
    await duplicateTemplate(id)
  }

  async function handleCreateTemplate() {
    const name = newTemplateName.trim()
    if (!name) return
    await createTemplate(name)
    setNewTemplateName('')
    setAddingTemplate(false)
  }

  async function handleSaveDay() {
    if (!editingDay) return
    const { templateId, day } = editingDay
    await upsertDay(templateId, {
      day_index: day.day_index,
      label: day.label,
      muscle_groups: day.muscle_groups,
    })
    setEditingDay(null)
  }

  function toggleMuscle(muscle) {
    if (!editingDay) return
    setEditingDay(prev => {
      const groups = prev.day.muscle_groups.includes(muscle)
        ? prev.day.muscle_groups.filter(m => m !== muscle)
        : [...prev.day.muscle_groups, muscle]
      return { ...prev, day: { ...prev.day, muscle_groups: groups } }
    })
  }

  if (editingDay) {
    const { day } = editingDay
    return (
      <div>
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => setEditingDay(null)}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-card border border-border text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >←</button>
          <div>
            <h2 className="font-condensed font-bold text-white uppercase tracking-wide leading-none" style={{ fontSize: '1.5rem' }}>
              Edit Day
            </h2>
            <p className="text-zinc-600 text-xs mt-0.5">Day {day.day_index + 1}</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 mb-4">
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Label</p>
          <input
            value={day.label}
            onChange={e => setEditingDay(prev => ({ ...prev, day: { ...prev.day, label: e.target.value } }))}
            placeholder="e.g. Push, Upper, Full Body…"
            className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-accent transition-colors mb-4"
          />
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Target muscle groups</p>
          <div className="flex flex-wrap gap-2">
            {MUSCLE_GROUPS.map(m => {
              const active = day.muscle_groups.includes(m)
              return (
                <button
                  key={m}
                  onClick={() => toggleMuscle(m)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    active
                      ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-400'
                      : 'bg-transparent border-border text-zinc-600 hover:text-zinc-300 hover:border-zinc-600'
                  }`}
                >{m}</button>
              )
            })}
          </div>
        </div>

        <button
          onClick={handleSaveDay}
          className="w-full py-3.5 bg-accent/10 border border-accent/30 text-accent font-condensed font-bold uppercase tracking-wider rounded-2xl text-base hover:bg-accent/20 transition-colors cursor-pointer"
        >
          Save day
        </button>
      </div>
    )
  }

  return (
    <div>
      <h2 className="font-condensed font-bold text-white uppercase tracking-wide mb-5" style={{ fontSize: '1.75rem', lineHeight: 1 }}>
        Splits
      </h2>

      {systemTemplates.length > 0 && (
        <>
          <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-3">System defaults</p>
          {systemTemplates.map(t => (
            <TemplateCard
              key={t.id}
              template={t}
              isSystem
              onDuplicate={() => handleDuplicate(t.id)}
            />
          ))}
        </>
      )}

      {userTemplates.length > 0 && (
        <>
          <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mt-4 mb-3">My templates</p>
          {userTemplates.map(t => (
            <TemplateCard
              key={t.id}
              template={t}
              onEditDay={(day) => setEditingDay({ templateId: t.id, day: { ...day, muscle_groups: [...day.muscle_groups] } })}
              onDelete={() => deleteTemplate(t.id)}
            />
          ))}
        </>
      )}

      <div className="mt-4">
        {addingTemplate ? (
          <div className="bg-card border border-border rounded-2xl p-4">
            <input
              autoFocus
              value={newTemplateName}
              onChange={e => setNewTemplateName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateTemplate(); if (e.key === 'Escape') setAddingTemplate(false) }}
              placeholder="Template name…"
              className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-accent transition-colors mb-3"
            />
            <div className="flex gap-2">
              <button onClick={handleCreateTemplate} className="flex-1 py-2.5 bg-accent/10 border border-accent/30 text-accent rounded-xl text-sm font-bold cursor-pointer hover:bg-accent/20 transition-colors">
                Create
              </button>
              <button onClick={() => setAddingTemplate(false)} className="flex-1 py-2.5 border border-border text-zinc-500 rounded-xl text-sm font-bold cursor-pointer hover:text-zinc-300 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddingTemplate(true)}
            className="w-full py-3 border border-dashed border-zinc-700 text-zinc-600 hover:text-zinc-400 hover:border-zinc-600 rounded-2xl text-sm font-bold uppercase tracking-wider transition-colors cursor-pointer"
          >
            + New split template
          </button>
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-border">
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-2">Muscle group reference</p>
        <p className="text-zinc-700 text-xs leading-relaxed">{MUSCLE_GROUPS.join(' · ')}</p>
      </div>
    </div>
  )
}

function TemplateCard({ template, isSystem, onDuplicate, onEditDay, onDelete }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={`bg-card border rounded-2xl mb-3 overflow-hidden ${isSystem ? 'border-border' : 'border-accent/20'}`}>
      <div className="flex items-center justify-between p-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold text-white text-sm">{template.name}</p>
            {!isSystem && (
              <span className="text-[9px] font-bold text-accent bg-accent/10 border border-accent/20 rounded-full px-2 py-0.5 uppercase tracking-wider">
                Mine
              </span>
            )}
          </div>
          <p className="text-[10px] text-zinc-600 mt-0.5">
            {isSystem ? 'System default · ' : ''}{template.split_days.length} day{template.split_days.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isSystem && (
            <button
              onClick={onDuplicate}
              className="px-3 py-1.5 border border-accent/30 text-accent text-xs font-bold rounded-xl hover:bg-accent/10 transition-colors cursor-pointer"
            >
              Duplicate
            </button>
          )}
          {!isSystem && onDelete && (
            <button
              onClick={onDelete}
              className="text-zinc-700 hover:text-red-400 p-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
                <polyline points="3 6 5 6 17 6" /><path d="M8 6V4h4v2" /><path d="M5 6l1 11h8l1-11" />
              </svg>
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-zinc-600 text-xs cursor-pointer px-1"
          >
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-2">
          {template.split_days.map(day => (
            <div key={day.id} className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white uppercase tracking-wide">{day.label}</p>
                {day.muscle_groups.length > 0 && (
                  <p className="text-[10px] text-zinc-600 mt-0.5">{day.muscle_groups.join(', ')}</p>
                )}
              </div>
              {!isSystem && onEditDay && (
                <button
                  onClick={() => onEditDay(day)}
                  className="text-zinc-600 hover:text-accent text-xs font-semibold transition-colors cursor-pointer shrink-0"
                >
                  Edit
                </button>
              )}
            </div>
          ))}
          {!isSystem && (
            <button
              onClick={() => onEditDay({ id: null, day_index: template.split_days.length, label: '', muscle_groups: [] })}
              className="w-full text-left text-xs text-zinc-700 hover:text-zinc-400 pt-2 border-t border-border transition-colors cursor-pointer"
            >
              + Add day
            </button>
          )}
        </div>
      )}
    </div>
  )
}
