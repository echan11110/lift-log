import { useState, useRef, useEffect } from 'react'

export default function ExerciseAutocomplete({ onAdd, onAddCardio, search, searchCardio }) {
  const [value, setValue] = useState('')
  const [strengthSuggestions, setStrengthSuggestions] = useState([])
  const [cardioSuggestions, setCardioSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onClick(e) {
      if (!ref.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function handleChange(e) {
    const v = e.target.value
    setValue(v)
    setStrengthSuggestions(search(v))
    setCardioSuggestions(searchCardio ? searchCardio(v) : [])
    setOpen(true)
  }

  function handleSelect(name) {
    setValue('')
    setStrengthSuggestions([])
    setCardioSuggestions([])
    setOpen(false)
    onAdd(name)
  }

  function handleSelectCardio(name) {
    setValue('')
    setStrengthSuggestions([])
    setCardioSuggestions([])
    setOpen(false)
    if (onAddCardio) onAddCardio(name)
    else onAdd(name)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && value.trim()) {
      e.preventDefault()
      handleSelect(value.trim())
    }
    if (e.key === 'Escape') setOpen(false)
  }

  const hasResults = strengthSuggestions.length > 0 || cardioSuggestions.length > 0

  return (
    <div ref={ref} className="relative">
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setStrengthSuggestions(search(value))
            setCardioSuggestions(searchCardio ? searchCardio(value) : [])
            setOpen(true)
          }}
          placeholder="Exercise name…"
          className="flex-1 bg-surface border border-border rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-accent transition-colors"
        />
        <button
          onClick={() => value.trim() && handleSelect(value.trim())}
          className="bg-accent hover:bg-accentHov text-white px-4 py-3 rounded-xl font-medium transition-colors whitespace-nowrap"
        >
          + Add
        </button>
      </div>

      {open && hasResults && (
        <ul className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl overflow-hidden z-20">
          {strengthSuggestions.length > 0 && (
            <>
              {cardioSuggestions.length > 0 && (
                <li className="px-4 py-1.5 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider bg-card/80">
                  Strength
                </li>
              )}
              {strengthSuggestions.map(name => (
                <li key={name}>
                  <button
                    onMouseDown={e => { e.preventDefault(); handleSelect(name) }}
                    className="w-full text-left px-4 py-3 text-sm text-zinc-200 hover:bg-border transition-colors"
                  >
                    {name}
                  </button>
                </li>
              ))}
            </>
          )}
          {cardioSuggestions.length > 0 && (
            <>
              <li className="px-4 py-1.5 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider bg-card/80 border-t border-border">
                Cardio
              </li>
              {cardioSuggestions.map(name => (
                <li key={name}>
                  <button
                    onMouseDown={e => { e.preventDefault(); handleSelectCardio(name) }}
                    className="w-full text-left px-4 py-3 text-sm text-blue-400 hover:bg-border transition-colors flex items-center gap-2"
                  >
                    {name}
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-blue-500/60">cardio</span>
                  </button>
                </li>
              ))}
            </>
          )}
        </ul>
      )}
    </div>
  )
}
