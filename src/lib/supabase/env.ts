/**
 * Pembacaan variabel lingkungan Supabase dengan kegagalan yang berisik.
 *
 * Sebelumnya berkas klien memakai nilai cadangan 'https://demo.supabase.co' dan
 * 'demo-anon-key'. Akibatnya, bila variabel lingkungan lupa diisi di Vercel,
 * aplikasi tetap berjalan namun setiap panggilan ke Supabase gagal diam-diam dan
 * pengguna hanya melihat pesan galat umum. Berkas ini menghentikan pola itu:
 * konfigurasi yang hilang langsung dilaporkan apa adanya.
 */

function wajib(nama: string, nilai: string | undefined): string {
  const bersih = (nilai ?? '').trim()
  if (!bersih || bersih.startsWith('demo-') || bersih.includes('demo.supabase.co')) {
    throw new Error(
      `Konfigurasi ${nama} belum diisi. Tambahkan di Environment Variables Vercel ` +
        `(scope Production) lalu jalankan Redeploy, atau isi di .env.local untuk pengembangan lokal.`,
    )
  }
  return bersih
}

export function urlSupabase(): string {
  return wajib('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL)
}

export function kunciAnonSupabase(): string {
  return wajib('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

/** Alamat situs untuk tautan konfirmasi surel. */
export function urlSitus(): string {
  const bersih = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim().replace(/\/+$/, '')
  if (bersih) return bersih
  const vercel = (process.env.VERCEL_URL ?? '').trim()
  if (vercel) return `https://${vercel}`
  return 'http://localhost:3000'
}
