import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Fail the build when Supabase credentials are absent.
//
// src/lib/supabase.js falls back to placeholder credentials so createClient can't
// throw, and App.jsx then renders a "create a .env.local" screen. That is right
// for local development, but a CI build with missing secrets used to exit 0 and
// deploy happily — so every visitor got a developer setup screen while the
// workflow stayed green. Production builds now fail loudly instead.
function requireSupabaseEnv(mode) {
  return {
    name: 'require-supabase-env',
    apply: 'build',
    buildStart() {
      const env = loadEnv(mode, process.cwd(), 'VITE_')
      const missing = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']
        .filter(k => !env[k] && !process.env[k])
      if (missing.length) {
        this.error(
          `Missing required env var(s): ${missing.join(', ')}.\n` +
          'A production build without Supabase credentials would deploy an unusable app.\n' +
          'Set them in .env.local locally, or as repository secrets in CI.'
        )
      }
    },
  }
}

export default defineConfig(({ command, mode }) => ({
  plugins: [react(), requireSupabaseEnv(mode)],
  // Use /lift-log/ base only for production builds (GitHub Pages).
  // In dev, serve from root so http://localhost:5183/ works without redirects.
  base: command === 'build' ? '/lift-log/' : '/',
  test: {
    // Only the committed suite. audit/ holds throwaway audit scripts and
    // Playwright specs that must not be picked up by `npm test`.
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    exclude: ['**/node_modules/**', 'audit/**', 'dist/**'],
  },
}))
