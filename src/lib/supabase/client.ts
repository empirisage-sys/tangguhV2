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
import { kunciAnonSupabase, urlSupabase } from './env'

export function createClient() {
  return createBrowserClient<any>(
    urlSupabase(),
    kunciAnonSupabase(),
  )
}
