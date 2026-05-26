import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Use /lift-log/ base only for production builds (GitHub Pages).
  // In dev, serve from root so localhost:5174/ works without redirects.
  base: command === 'build' ? '/lift-log/' : '/',
}))
