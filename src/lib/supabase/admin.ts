/**
 * Klien Supabase dengan kunci rahasia, yang MELEWATI seluruh policy RLS.
 *
 * ==========================================================================
 * BERKAS INI TIDAK BOLEH DIIMPOR OLEH KODE APLIKASI.
 *
 * Hanya untuk skrip yang dijalankan di terminal lokal, yaitu migrasi data dari
 * Firestore dan penyiapan admin pertama.
 *
 * Yang tidak boleh dilakukan, tanpa kecuali:
 *   - mengimpornya dari Server Action atau Server Component
 *   - menaruh SUPABASE_SERVICE_ROLE_KEY di Environment Variables Vercel
 *   - memakainya untuk uji RLS, karena kunci ini melewati RLS sehingga seluruh
 *     uji akan lulus secara menyesatkan
 *
 * Pemeriksaan di bawah akan menggagalkan proses bila berkas ini termuat di
 * lingkungan yang salah.
 * ==========================================================================
 */
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createAdminClient() {
  if (typeof window !== 'undefined') {
    throw new Error(
      'Klien admin dipakai di peramban. Ini kebocoran kunci rahasia. Hentikan dan perbaiki impornya.',
    )
  }

  const kunci = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!kunci) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY tidak tersedia. Kunci ini hanya diisi di .env.local pada komputer lokal, ' +
        'dan tidak boleh diisi di Vercel.',
    )
  }

  if (process.env.VERCEL) {
    throw new Error(
      'Klien admin dipanggil di lingkungan Vercel. Aplikasi tidak boleh memakai kunci rahasia. ' +
        'Periksa kembali berkas mana yang mengimpornya.',
    )
  }

  return createSupabaseClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    kunci,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}
