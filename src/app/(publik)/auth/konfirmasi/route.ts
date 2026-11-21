/**
 * Menukar kode konfirmasi email menjadi sesi.
 *
 * Dipanggil dari tautan yang dikirim Supabase ke email pendaftar. Bila tautan
 * ini mengarah ke localhost pada aplikasi yang sudah tayang, penyebabnya adalah
 * Site URL di pengaturan Authentication Supabase yang belum diubah. Itu
 * kekeliruan paling sering pada penerapan pertama.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const kode = searchParams.get('code')

  if (!kode) {
    return NextResponse.redirect(`${origin}/masuk?galat=tautan-tidak-sah`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(kode)

  if (error) {
    return NextResponse.redirect(`${origin}/masuk?galat=tautan-kedaluwarsa`)
  }

  // Tautan pemulihan sandi meminta diteruskan ke halaman sandi baru. Hanya
  // jalur internal yang diterima, agar tautan ini tidak dapat dipakai untuk
  // mengalihkan ke situs lain.
  const lanjut = searchParams.get('lanjut') ?? ''
  if (lanjut === '/atur-ulang-sandi') {
    return NextResponse.redirect(`${origin}${lanjut}`)
  }

  // Seluruh peran menunggu verifikasi setelah email dikonfirmasi.
  return NextResponse.redirect(`${origin}/menunggu-verifikasi`)
}
