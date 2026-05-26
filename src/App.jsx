import { Routes, Route, Navigate } from 'react-router-dom'
import { SUPABASE_CONFIGURED } from './lib/supabase'
import { useAuth } from './hooks/useAuth'
import AuthPage from './components/auth/AuthPage'
import Layout from './components/layout/Layout'
import LogView from './views/LogView'
import DailyView from './views/DailyView'
import WeeklyView from './views/WeeklyView'
import MonthlyView from './views/MonthlyView'
import ProgressView from './views/ProgressView'

export default function App() {
  const { user, loading } = useAuth()

  if (!SUPABASE_CONFIGURED) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh bg-surface px-6 text-center">
        <div className="text-4xl mb-4">🏋️</div>
        <h1 className="text-white font-bold text-2xl mb-2">Lift Log</h1>
        <p className="text-zinc-400 text-sm mb-6 max-w-xs">
          Supabase credentials are not configured. Create a{' '}
          <code className="text-accent bg-zinc-800 px-1.5 py-0.5 rounded">.env.local</code>{' '}
          file in the project root:
        </p>
        <div className="bg-card border border-border rounded-xl p-4 text-left text-sm font-mono w-full max-w-sm">
          <p className="text-zinc-400">VITE_SUPABASE_URL=<span className="text-green-400">https://….supabase.co</span></p>
          <p className="text-zinc-400">VITE_SUPABASE_ANON_KEY=<span className="text-green-400">eyJ…</span></p>
        </div>
        <p className="text-zinc-600 text-xs mt-4">Then restart the dev server.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-surface">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <AuthPage />
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/log" replace />} />
        <Route path="/log" element={<LogView />} />
        <Route path="/daily" element={<DailyView />} />
        <Route path="/week" element={<WeeklyView />} />
        <Route path="/month" element={<MonthlyView />} />
        <Route path="/progress" element={<ProgressView />} />
        <Route path="*" element={<Navigate to="/log" replace />} />
      </Routes>
    </Layout>
  )
}
