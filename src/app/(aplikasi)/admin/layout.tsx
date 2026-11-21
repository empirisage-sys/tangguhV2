import { redirect } from 'next/navigation'
import { ambilProfil } from '@/lib/supabase/penjaga'

/**
 * Penjaga navigasi seluruh halaman /admin.
 *
 * Halaman admin memanggil `wajibPeran(['admin'])`, yang MELEMPAR bila peran
 * tidak sesuai. Di Server Component, lemparan itu tampil sebagai halaman galat
 * 500 (temuan audit 21 November 2026). Di sini pengguna dialihkan lebih dulu
 * dengan sopan; `wajibPeran` di setiap halaman dan tindakan tetap berlaku.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profil = await ambilProfil()
  if (!profil) redirect('/masuk')
  if (profil.peran !== 'admin' || profil.statusAkun !== 'disetujui') redirect('/dasbor')
  return <>{children}</>
}
