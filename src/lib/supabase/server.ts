/**
 * Klien Supabase untuk Server Component, Server Action, dan Route Handler.
 *
 * Hanya memakai `getAll` dan `setAll` untuk cookie. Pola lama `get`, `set`, dan
 * `remove` sudah tidak didukung dan akan menyebabkan sesi tidak stabil.
 */
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://demo.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'demo-anon-key',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Dipanggil dari Server Component, tempat cookie tidak dapat ditulis.
            // Penyegaran sesi diurus oleh proxy.ts, jadi ini aman diabaikan.
          }
        },
      },
    },
  )
}
