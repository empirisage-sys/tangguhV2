/**
 * Klien Supabase untuk peramban.
 *
 * Dipakai di Client Component: formulir masuk, formulir pengukuran, dan antrean
 * sinkronisasi offline.
 *
 * Kunci yang dipakai di sini bersifat publik dan memang dirancang untuk terlihat
 * di peramban. Yang melindungi data bukan kerahasiaan kunci ini, melainkan
 * policy Row Level Security di database.
 */
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://demo.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'demo-anon-key',
  )
}
