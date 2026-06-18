const KNOWN_COLORS = {
  Push:  { bg: 'bg-red-500/15',     text: 'text-red-400',     dot: 'bg-red-500',     border: 'border-red-500/30' },
  Pull:  { bg: 'bg-sky-500/15',     text: 'text-sky-400',     dot: 'bg-sky-500',     border: 'border-sky-500/30' },
  Legs:  { bg: 'bg-emerald-500/15', text: 'text-emerald-400', dot: 'bg-emerald-500', border: 'border-emerald-500/30' },
  Arms:  { bg: 'bg-amber-500/15',   text: 'text-amber-400',   dot: 'bg-amber-500',   border: 'border-amber-500/30' },
}

const FALLBACK_PALETTE = [
  { bg: 'bg-purple-500/15',  text: 'text-purple-400',  dot: 'bg-purple-500',  border: 'border-purple-500/30' },
  { bg: 'bg-cyan-500/15',    text: 'text-cyan-400',    dot: 'bg-cyan-500',    border: 'border-cyan-500/30' },
  { bg: 'bg-pink-500/15',    text: 'text-pink-400',    dot: 'bg-pink-500',    border: 'border-pink-500/30' },
  { bg: 'bg-lime-500/15',    text: 'text-lime-400',    dot: 'bg-lime-500',    border: 'border-lime-500/30' },
  { bg: 'bg-orange-500/15',  text: 'text-orange-400',  dot: 'bg-orange-500',  border: 'border-orange-500/30' },
  { bg: 'bg-teal-500/15',    text: 'text-teal-400',    dot: 'bg-teal-500',    border: 'border-teal-500/30' },
]

function hashLabel(label) {
  let h = 0
  for (const ch of label) h = (h * 31 + ch.charCodeAt(0)) & 0xffff
  return h % FALLBACK_PALETTE.length
}

export function splitColor(split) {
  if (!split) return { bg: 'bg-zinc-800/60', text: 'text-zinc-400', dot: 'bg-zinc-500', border: 'border-zinc-600/30' }
  return KNOWN_COLORS[split] ?? FALLBACK_PALETTE[hashLabel(split)]
}

export default function SplitBadge({ split, size = 'sm' }) {
  if (!split) return null
  const c = splitColor(split)
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border ${c.bg} ${c.text} ${c.border} ${size === 'lg' ? 'text-sm font-semibold' : 'text-xs font-medium'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {split}
    </span>
  )
}
