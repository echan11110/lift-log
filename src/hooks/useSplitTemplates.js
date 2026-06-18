import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useSplitTemplates() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('split_templates')
        .select('*, split_days(*)')
        .or(`user_id.is.null,user_id.eq.${user.id}`)
        .order('created_at')
      if (data) {
        setTemplates(data.map(t => ({
          ...t,
          split_days: [...(t.split_days ?? [])].sort((a, b) => a.day_index - b.day_index),
        })))
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const duplicateTemplate = useCallback(async (templateId) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const source = templates.find(t => t.id === templateId)
    if (!source) return

    const { data: newTpl } = await supabase
      .from('split_templates')
      .insert({ user_id: user.id, name: `${source.name} (copy)` })
      .select()
      .single()
    if (!newTpl) return

    if (source.split_days.length) {
      await supabase.from('split_days').insert(
        source.split_days.map(({ day_index, label, muscle_groups }) => ({
          template_id: newTpl.id, day_index, label, muscle_groups,
        }))
      )
    }
    await load()
    return newTpl.id
  }, [templates, load])

  const createTemplate = useCallback(async (name) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('split_templates')
      .insert({ user_id: user.id, name })
      .select()
      .single()
    await load()
    return data?.id
  }, [load])

  const updateTemplate = useCallback(async (templateId, fields) => {
    await supabase.from('split_templates').update(fields).eq('id', templateId)
    await load()
  }, [load])

  const deleteTemplate = useCallback(async (templateId) => {
    await supabase.from('split_templates').delete().eq('id', templateId)
    setTemplates(prev => prev.filter(t => t.id !== templateId))
  }, [])

  const upsertDay = useCallback(async (templateId, day) => {
    await supabase.from('split_days').upsert(
      { template_id: templateId, ...day },
      { onConflict: 'template_id,day_index' }
    )
    await load()
  }, [load])

  const deleteDay = useCallback(async (dayId) => {
    await supabase.from('split_days').delete().eq('id', dayId)
    await load()
  }, [load])

  return {
    templates,
    loading,
    reload: load,
    duplicateTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    upsertDay,
    deleteDay,
  }
}
