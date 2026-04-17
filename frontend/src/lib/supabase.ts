import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL     as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

console.log('[supabase] VITE_SUPABASE_URL =', supabaseUrl ?? '(undefined — env var not injected at build time)')
console.log('[supabase] VITE_SUPABASE_ANON_KEY present =', !!supabaseAnonKey)

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase env vars missing at build time. ' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel → Settings → Environment Variables, ' +
    'then redeploy without build cache.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
