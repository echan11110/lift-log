import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const SUPABASE_CONFIGURED = Boolean(supabaseUrl && supabaseAnonKey)

if (!SUPABASE_CONFIGURED) {
  console.warn(
    '[Lift Log] Missing Supabase env vars.\n' +
    'Create a .env.local file with:\n' +
    '  VITE_SUPABASE_URL=https://your-project.supabase.co\n' +
    '  VITE_SUPABASE_ANON_KEY=your-anon-key'
  )
}

// Use a placeholder URL so createClient doesn't throw — all calls will fail
// gracefully with network errors when credentials are absent.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
)
