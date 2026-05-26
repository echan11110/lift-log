import { useState, useRef, useEffect } from 'react'

export default function ExerciseAutocomplete({ onAdd, search }) {
  const [value, setValue] = useState('')
  const [suggestions, setSuggestions] = useState([])
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
    setSuggestions(search(v))
    setOpen(true)
  }

  function handleSelect(name) {
    setValue('')
    setSuggestions([])
    setOpen(false)
    onAdd(name)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && value.trim()) {
      e.preventDefault()
      handleSelect(value.trim())
    }
    if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { setSuggestions(search(value)); setOpen(true) }}
          placeholder="Exercise name…"
          className="flex-1 bg-surface border border-border rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-accent transition-colors"
        />
        <button
          onClick={() => value.trim() && handleSelect(value.trim())}
          className="bg-accent hover:bg-blue-500 text-white px-4 py-3 rounded-xl font-medium transition-colors whitespace-nowrap"
        >
          + Add
        </button>
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl overflow-hidden z-20 shadow-xl">
          {suggestions.map(name => (
            <li key={name}>
              <button
                onMouseDown={e => { e.preventDefault(); handleSelect(name) }}
                className="w-full text-left px-4 py-3 text-sm text-zinc-200 hover:bg-border transition-colors"
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
