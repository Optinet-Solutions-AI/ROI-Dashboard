import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'path'

export default defineConfig(({ mode }) => {
  // Local dev: read from root .env (one level up)
  const fromFile = loadEnv(mode, path.resolve(__dirname, '..'), 'SUPABASE_')

  // Vercel / CI: env vars are injected as process.env, not .env files
  const supabaseUrl     = fromFile.SUPABASE_URL      || process.env.SUPABASE_URL      || ''
  const supabaseAnonKey = fromFile.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''

  return {
    plugins: [
      react(),
      visualizer({ filename: 'dist/stats.html', gzipSize: true, brotliSize: true, template: 'treemap' }),
    ],
    define: {
      'import.meta.env.VITE_SUPABASE_URL':      JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
    },
  }
})
