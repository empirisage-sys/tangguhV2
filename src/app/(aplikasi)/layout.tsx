import { redirect } from 'next/navigation'
import { ambilProfil } from '@/lib/supabase/penjaga'
import { NavigasiUtama } from '@/components/navigasi/NavigasiUtama'
import { IndikatorOffline } from '@/components/offline/IndikatorOffline'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profil = await ambilProfil()

  // Jika belum masuk atau belum disetujui, proxy.ts sudah mengurus pengalihan.
  // Sebagai pertahanan sekunder:
  if (!profil) {
    // Tanpa sesi yang sah di aplikasi yang tersambung ke Supabase: ke halaman
    // masuk. Dahulu cabang ini SELALU menampilkan profil "Petugas Demo",
    // termasuk di produksi bagi siapa pun yang belum login atau sesinya habis
    // (temuan audit 21 November 2026). Profil demo kini hanya untuk pratinjau
    // lokal tanpa variabel Supabase.
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      redirect('/masuk')
    }
    // Fallback profil untuk tampilan pratinjau lokal bila tanpa koneksi supabase
    const demoProfil = {
      id: 'demo-user',
      namaLengkap: 'Petugas Demo (TANGGUH)',
      peran: 'dokter' as const,
      statusAkun: 'disetujui' as const,
      alasanTolak: null,
      posyanduId: 'pos-7571-01-01',
      puskesmasId: 'pus-7571-01',
      kabupatenId: 'kab-7571',
    }

    return (
      <div className="flex min-h-screen flex-col bg-kabut-50 pb-20 md:pb-8">
        <NavigasiUtama profil={demoProfil} />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
          {children}
        </main>
        <IndikatorOffline />
      </div>
    )
  }

  if (profil.statusAkun !== 'disetujui') {
    redirect('/menunggu-verifikasi')
  }

  return (
    <div className="flex min-h-screen flex-col bg-kabut-50 pb-20 md:pb-8">
      <NavigasiUtama profil={profil} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        {children}
      </main>
      <IndikatorOffline />
    </div>
  )
}
