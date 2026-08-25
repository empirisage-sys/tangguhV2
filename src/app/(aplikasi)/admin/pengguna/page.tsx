import { wajibPeran } from '@/lib/supabase/penjaga'
import { createClient } from '@/lib/supabase/server'
import { TabelManajemenPengguna, type PenggunaItem } from './TabelManajemenPengguna'
import { Users, UserCheck, Clock, UserX } from 'lucide-react'

export const metadata = {
  title: 'Manajemen Pengguna & Akun | Administrator TANGGUH',
}

export default async function HalamanManajemenPengguna() {
  await wajibPeran(['admin'])
  const supabase = await createClient()

  let daftarPengguna: PenggunaItem[] = []

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        nama_lengkap,
        role,
        no_hp,
        no_str,
        status_akun,
        created_at,
        puskesmas:puskesmas_id ( nama ),
        kabupaten:kabupaten_id ( nama ),
        posyandu:posyandu_id ( nama )
      `)
      .order('created_at', { ascending: false })

    if (!error && data) {
      daftarPengguna = data.map((item: any) => ({
        id: item.id,
        namaLengkap: item.nama_lengkap ?? 'Tanpa Nama',
        role: item.role ?? 'kader',
        noHp: item.no_hp ?? null,
        noStr: item.no_str ?? null,
        statusAkun: item.status_akun ?? 'menunggu',
        puskesmasNama: item.puskesmas?.nama ?? null,
        kabupatenNama: item.kabupaten?.nama ?? null,
        posyanduNama: item.posyandu?.nama ?? null,
        createdAt: item.created_at ?? null,
      }))
    }
  } catch (err) {
    console.warn('Fallback error query profiles:', err)
  }

  // Statistik Ringkas
  const total = daftarPengguna.length
  const aktif = daftarPengguna.filter((p) => p.statusAkun === 'disetujui').length
  const menunggu = daftarPengguna.filter((p) => p.statusAkun === 'menunggu').length
  const ditolak = daftarPengguna.filter((p) => p.statusAkun === 'ditolak').length

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-laut-100 px-3 py-1 text-xs font-bold text-laut-800">
            <Users className="size-3.5 text-laut-600" />
            <span>Administrator Control Center</span>
          </div>
          <h1 className="font-display mt-2 text-2xl font-bold text-tinta-900 sm:text-3xl">
            Manajemen Akun Pengguna
          </h1>
          <p className="mt-1 text-xs text-tinta-600 sm:text-sm">
            Kelola data akun tenaga kesehatan, dokter, dietisien, dan kader posyandu yang terdaftar di sistem.
          </p>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="rounded-2xl bg-white p-4 shadow-[var(--shadow-kartu)] border border-kabut-100">
          <div className="flex items-center justify-between text-tinta-500">
            <span className="text-xs font-semibold">Total Pengguna</span>
            <Users className="size-4 text-laut-600" />
          </div>
          <p className="font-display mt-2 text-2xl font-extrabold text-tinta-900">{total}</p>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-[var(--shadow-kartu)] border border-kabut-100">
          <div className="flex items-center justify-between text-emerald-600">
            <span className="text-xs font-semibold">Akun Aktif</span>
            <UserCheck className="size-4" />
          </div>
          <p className="font-display mt-2 text-2xl font-extrabold text-emerald-700">{aktif}</p>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-[var(--shadow-kartu)] border border-kabut-100">
          <div className="flex items-center justify-between text-amber-600">
            <span className="text-xs font-semibold">Menunggu</span>
            <Clock className="size-4" />
          </div>
          <p className="font-display mt-2 text-2xl font-extrabold text-amber-700">{menunggu}</p>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-[var(--shadow-kartu)] border border-kabut-100">
          <div className="flex items-center justify-between text-rose-600">
            <span className="text-xs font-semibold">Ditolak</span>
            <UserX className="size-4" />
          </div>
          <p className="font-display mt-2 text-2xl font-extrabold text-rose-700">{ditolak}</p>
        </div>
      </div>

      {/* Interactive Table with Edit, Reset Sandi, & Delete Modals */}
      <TabelManajemenPengguna daftar={daftarPengguna} />
    </main>
  )
}
