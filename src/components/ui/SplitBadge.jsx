const SPLIT_COLORS = {
  Push:  { bg: 'bg-red-500/15',    text: 'text-red-400',    dot: 'bg-red-500',    border: 'border-red-500/30' },
  Pull:  { bg: 'bg-sky-500/15',    text: 'text-sky-400',    dot: 'bg-sky-500',    border: 'border-sky-500/30' },
  Legs:  { bg: 'bg-emerald-500/15',text: 'text-emerald-400',dot: 'bg-emerald-500',border: 'border-emerald-500/30' },
  Arms:  { bg: 'bg-amber-500/15',  text: 'text-amber-400',  dot: 'bg-amber-500',  border: 'border-amber-500/30' },
}

export function splitColor(split) {
  return SPLIT_COLORS[split] ?? { bg: 'bg-zinc-800/60', text: 'text-zinc-400', dot: 'bg-zinc-500', border: 'border-zinc-600/30' }
}

export default function SplitBadge({ split, size = 'sm' }) {
  const c = splitColor(split)
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border ${c.bg} ${c.text} ${c.border} ${size === 'lg' ? 'text-sm font-semibold' : 'text-xs font-medium'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {split}
    </span>
  )
}
