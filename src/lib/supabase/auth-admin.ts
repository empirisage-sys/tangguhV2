/**
 * Klien Auth Admin Supabase untuk Server Action yang mengelola AKUN.
 *
 * ==========================================================================
 * PAKAI HANYA UNTUK `auth.admin.*`, TIDAK UNTUK MEMBACA ATAU MENULIS TABEL.
 *
 * Kunci rahasia melewati seluruh policy RLS. Karena itu klien ini hanya boleh
 * dipakai untuk operasi akun yang memang tidak dapat dilakukan dengan sesi
 * pengguna: membuat akun dengan sandi sementara, mengatur ulang sandi, dan
 * mengubah `app_metadata`. Seluruh penulisan ke tabel `profiles` tetap
 * memakai sesi administrator, sehingga RLS dan fungsi `verifikasi_pengguna`
 * tetap berlaku dan tercatat atas nama admin yang bertindak.
 *
 * Pemanggil WAJIB sudah lolos `wajibPeran(['admin'])` (atau, untuk penggantian
 * sandi sendiri, sudah memastikan id yang diubah adalah id sesi) sebelum
 * memakai klien ini.
 *
 * Kunci dibaca dari `SUPABASE_SERVICE_ROLE_KEY` di lingkungan server. Bila
 * kunci tidak tersedia, fungsi ini mengembalikan `null` dan pemanggil
 * menampilkan pesan, bukan galat.
 * ==========================================================================
 */
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function klienAuthAdmin() {
  if (typeof window !== 'undefined') {
    throw new Error('Klien auth admin dipakai di peramban. Ini kebocoran kunci rahasia.')
  }
  const kunci = process.env.SUPABASE_SERVICE_ROLE_KEY
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!kunci || !url) return null
  return createSupabaseClient(url, kunci, {
    auth: { autoRefreshToken: false, persistSession: false },
  }).auth.admin
}

export const PESAN_KUNCI_TIDAK_ADA =
  'Kunci server untuk mengelola akun belum dipasang (SUPABASE_SERVICE_ROLE_KEY di Vercel). ' +
  'Hubungi teknisi untuk memasangnya sebagai variabel server, bukan NEXT_PUBLIC_.'
