/**
 * Penyegaran sesi dan pengalihan halaman.
 *
 * Di Next.js 16 berkas ini bernama `proxy.ts`, bukan `middleware.ts`, dan fungsi
 * yang diekspor bernama `proxy`.
 *
 * BUKAN LAPISAN KEAMANAN. Berkas ini hanya mengurus dua hal: menyegarkan token
 * sesi dan mengalihkan pengguna ke halaman yang tepat. Seseorang yang memanggil
 * Server Action atau API secara langsung tidak melewati berkas ini sama sekali.
 * Otorisasi ditegakkan oleh `src/lib/supabase/penjaga.ts` dan policy RLS.
 */
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const JALUR_PUBLIK = ['/', '/masuk', '/daftar', '/lupa-sandi', '/auth', '/api']

/** Halaman yang boleh dibuka pengguna yang akunnya belum disetujui. */
const JALUR_MENUNGGU = ['/menunggu-verifikasi', '/profil', '/keluar']

function cocok(path: string, daftar: string[]): boolean {
  return daftar.some((p) => path === p || path.startsWith(`${p}/`))
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    // Mode demo / pratinjau lokal tanpa koneksi Supabase langsung diizinkan
    return response
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const { data } = await supabase.auth.getClaims()
  const penggunaId = data?.claims?.sub

  const path = request.nextUrl.pathname

  if (!penggunaId) {
    if (cocok(path, JALUR_PUBLIK)) return response
    const url = request.nextUrl.clone()
    url.pathname = '/masuk'
    url.searchParams.set('lanjut', path)
    return NextResponse.redirect(url)
  }

  // Sudah masuk, tetapi masih di halaman masuk atau daftar.
  if (path === '/masuk' || path === '/daftar') {
    const url = request.nextUrl.clone()
    url.pathname = '/dasbor'
    url.search = ''
    return NextResponse.redirect(url)
  }

  if (!cocok(path, JALUR_PUBLIK) && !cocok(path, JALUR_MENUNGGU)) {
    const { data: profil } = await supabase
      .from('profiles')
      .select('status_akun')
      .eq('id', penggunaId)
      .maybeSingle()

    if (!profil || profil.status_akun !== 'disetujui') {
      const url = request.nextUrl.clone()
      url.pathname = '/menunggu-verifikasi'
      url.search = ''
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icon-.*|.*\\.(?:svg|png|jpg|jpeg|webp|woff2)$).*)',
  ],
}
