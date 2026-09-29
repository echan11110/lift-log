// Fixed above the bottom nav so it is visible wherever you are scrolled.
// The save indicator used to render inline above the exercise list, which meant
// that while editing set 5 of exercise 6 the only failure signal in the app was
// off-screen.
export function ToastStack({ children }) {
  return (
    <div className="fixed left-0 right-0 bottom-24 z-40 px-4 pointer-events-none">
      <div className="max-w-lg mx-auto flex flex-col gap-2 items-stretch">
        {children}
      </div>
    </div>
  )
}

const TONES = {
  neutral: 'bg-card border-border text-zinc-400',
  error: 'bg-red-950/90 border-red-800 text-red-200',
  accent: 'bg-card border-accent/40 text-white',
}

export function Toast({ tone = 'neutral', children, action, onAction, role }) {
  return (
    <div
      role={role}
      className={`pointer-events-auto flex items-center gap-3 border rounded-xl px-4 py-3 shadow-xl backdrop-blur-sm animate-fade-in ${TONES[tone]}`}
    >
      <span className="text-sm flex-1 min-w-0">{children}</span>
      {action && (
        <button
          onClick={onAction}
          className="shrink-0 text-xs font-bold uppercase tracking-wider px-3 min-h-11 rounded-lg border border-current/30 hover:bg-white/10 transition-colors cursor-pointer"
        >
          {action}
        </button>
      )}
    </div>
  )
}
