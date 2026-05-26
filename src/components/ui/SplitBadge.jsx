const SPLIT_COLORS = {
  Push:  { bg: 'bg-red-900/50',    text: 'text-red-300',    dot: 'bg-red-400' },
  Pull:  { bg: 'bg-blue-900/50',   text: 'text-blue-300',   dot: 'bg-blue-400' },
  Legs:  { bg: 'bg-green-900/50',  text: 'text-green-300',  dot: 'bg-green-400' },
  Arms:  { bg: 'bg-orange-900/50', text: 'text-orange-300', dot: 'bg-orange-400' },
}

export function splitColor(split) {
  return SPLIT_COLORS[split] ?? { bg: 'bg-zinc-800', text: 'text-zinc-300', dot: 'bg-zinc-400' }
}

export default function SplitBadge({ split, size = 'sm' }) {
  const c = splitColor(split)
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full ${c.bg} ${c.text} ${size === 'lg' ? 'text-sm' : 'text-xs'} font-medium`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {split}
    </span>
  )
}
