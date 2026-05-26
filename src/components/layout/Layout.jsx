import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import BottomNav from './BottomNav'

export default function Layout({ children }) {
  const [offline, setOffline] = useState(!navigator.onLine)
  const { signOut } = useAuth()

  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  return (
    <div className="flex flex-col min-h-dvh bg-surface">
      <header className="flex items-center justify-between px-4 py-3 bg-card border-b border-border sticky top-0 z-30">
        <span className="font-condensed font-bold text-white uppercase tracking-wide text-2xl leading-none">
          Lift<span className="text-accent">Log</span>
        </span>
        <button
          onClick={signOut}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-3 py-1.5 rounded-lg border border-border cursor-pointer"
        >
          Sign out
        </button>
      </header>

      {offline && (
        <div className="bg-yellow-900/50 border-b border-yellow-700/50 px-4 py-2 text-center">
          <p className="text-yellow-300 text-xs">You're offline — changes will sync when reconnected</p>
        </div>
      )}

      <main className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-lg mx-auto px-4 py-4">
          {children}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
