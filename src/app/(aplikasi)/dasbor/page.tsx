import Link from 'next/link'
import { ambilProfil } from '@/lib/supabase/penjaga'
import {
  Activity,
  AlertTriangle,
  Baby,
  BarChart3,
  Calendar,
  ChevronRight,
  FileSpreadsheet,
  HeartPulse,
  Plus,
  ShieldCheck,
  Sparkles,
  Users,
  Utensils,
} from 'lucide-react'
import { LencanaStatus } from '@/components/ui/LencanaStatus'
import { tampilanBBTB, tampilanTBU } from '@/lib/tampilan/status'
import { formatTanggal } from '@/lib/tampilan/format'
import type { StatusBBU, StatusTBU, StatusBBTB } from '@/lib/zscore/tipe'

type SampleBalitaItem = {
  id: string
  nama: string
  umurBulan: number
  jenisKelamin: 'L' | 'P'
  tanggalPeriksa: string
  beratKg: number
  panjangCm: number
  statusBBU: StatusBBU
  statusTBU: StatusTBU
  statusBBTB: StatusBBTB
  isRedFlag: boolean
}

// Data demonstrasi sampel untuk dasbor
const SAMPLE_BALITA_TERAKHIR: SampleBalitaItem[] = [
  {
    id: 'bal-01',
    nama: 'Ahmad Fadel',
    umurBulan: 24,
    jenisKelamin: 'L',
    tanggalPeriksa: '2026-08-19',
    beratKg: 8.0,
    panjangCm: 78.0,
    statusBBU: 'berat_badan_sangat_kurang',
    statusTBU: 'pendek',
    statusBBTB: 'gizi_buruk',
    isRedFlag: true,
  },
  {
    id: 'bal-02',
    nama: 'Nurul Aini',
    umurBulan: 18,
    jenisKelamin: 'P',
    tanggalPeriksa: '2026-08-18',
    beratKg: 9.8,
    panjangCm: 81.2,
    statusBBU: 'berat_badan_normal',
    statusTBU: 'normal',
    statusBBTB: 'gizi_baik',
    isRedFlag: false,
  },
  {
    id: 'bal-03',
    nama: 'Rizky Pratama',
    umurBulan: 12,
    jenisKelamin: 'L',
    tanggalPeriksa: '2026-08-16',
    beratKg: 7.9,
    panjangCm: 73.0,
    statusBBU: 'berat_badan_kurang',
    statusTBU: 'pendek',
    statusBBTB: 'gizi_kurang',
    isRedFlag: false,
  },
]

export default async function DasborPage() {
  const profil = await ambilProfil()
  const peran = profil?.peran ?? 'kader'
  const nama = profil?.namaLengkap ?? 'Petugas Posyandu'

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-laut-700 via-laut-600 to-laut-500 p-6 text-white shadow-lg shadow-laut-600/15 sm:p-8">
        <div className="relative z-10 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white backdrop-blur-md">
              <Sparkles className="size-3.5 text-karawo-400" />
              <span className="capitalize">Peran: {peran} Posyandu</span>
            </div>
            <h1 className="font-display mt-2 text-2xl font-extrabold sm:text-3xl">
              Halo, {nama} 👋
            </h1>
            <p className="mt-1 text-sm text-white/90">
              Selamat bertugas dalam percepatan penurunan stunting di Provinsi Gorontalo.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <Link
              href="/balita"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-laut-800 shadow-md transition-all hover:bg-kabut-50 active:scale-95"
            >
              <Activity className="size-4 text-laut-600" />
              Ukur / Skrining
            </Link>
            <Link
              href="/balita/baru"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-laut-900/40 px-4 text-sm font-semibold text-white ring-1 ring-white/25 transition-all hover:bg-laut-900/60"
            >
              <Plus className="size-4" />
              Balita Baru
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow-kartu)]">
          <div className="flex size-10 items-center justify-center rounded-xl bg-laut-50 text-laut-600">
            <Baby className="size-5" />
          </div>
          <p className="angka mt-3 text-2xl font-bold text-tinta-900 sm:text-3xl">48</p>
          <p className="text-xs font-semibold text-tinta-600">Balita Terdaftar</p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow-kartu)]">
          <div className="flex size-10 items-center justify-center rounded-xl bg-aman-bg text-aman-teks">
            <Activity className="size-5" />
          </div>
          <p className="angka mt-3 text-2xl font-bold text-aman-teks sm:text-3xl">36</p>
          <p className="text-xs font-semibold text-tinta-600">Ditimbang Bulan Ini</p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow-kartu)]">
          <div className="flex size-10 items-center justify-center rounded-xl bg-waspada-bg text-waspada-teks">
            <AlertTriangle className="size-5" />
          </div>
          <p className="angka mt-3 text-2xl font-bold text-waspada-teks sm:text-3xl">5</p>
          <p className="text-xs font-semibold text-tinta-600">Pendek / Wasted</p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow-kartu)]">
          <div className="flex size-10 items-center justify-center rounded-xl bg-bahaya-bg text-bahaya-teks">
            <HeartPulse className="size-5" />
          </div>
          <p className="angka mt-3 text-2xl font-bold text-bahaya-teks sm:text-3xl">2</p>
          <p className="text-xs font-semibold text-tinta-600">Perlu Rujukan (Red Flag)</p>
        </div>
      </div>

      {/* Main Sections */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Screening History & Urgent Items */}
        <div className="space-y-6 lg:col-span-2">
          {/* Action Alert Banner */}
          <div className="rounded-2xl bg-bahaya-bg p-5 ring-1 ring-bahaya-garis">
            <div className="flex items-start gap-3">
              <HeartPulse className="size-5 shrink-0 text-bahaya-teks" />
              <div className="flex-1">
                <h2 className="text-sm font-bold text-bahaya-teks">
                  2 Balita Memerlukan Intervensi & Rujukan Segera
                </h2>
                <p className="mt-1 text-xs text-bahaya-teks/90">
                  Ditemukan balita dengan status Gizi Buruk (BB/TB &lt; -3 SD) dan Stunting Berat pada penimbangan terakhir di Posyandu.
                </p>
                <div className="mt-3">
                  <Link
                    href="/dietisien"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-bahaya-teks px-3.5 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90"
                  >
                    Buka Tindak Lanjut Asuhan Gizi
                    <ChevronRight className="size-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Screening Table / Cards */}
          <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow-kartu)] sm:p-6">
            <div className="flex items-center justify-between border-b border-kabut-200 pb-4">
              <div>
                <h2 className="font-display text-base font-bold text-tinta-900 sm:text-lg">
                  Pengukuran Terakhir di Wilayah Anda
                </h2>
                <p className="text-xs text-tinta-600">Hasil perhitungan otomatis engine WHO zscore-2.0.0</p>
              </div>
              <Link
                href="/balita"
                className="text-xs font-bold text-laut-700 hover:underline"
              >
                Lihat Semua
              </Link>
            </div>

            <div className="mt-4 divide-y divide-kabut-100">
              {SAMPLE_BALITA_TERAKHIR.map((balita) => {
                const statusBB = tampilanBBTB(balita.statusBBTB)
                const statusTB = tampilanTBU(balita.statusTBU)

                return (
                  <div
                    key={balita.id}
                    className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/balita/${balita.id}`}
                          className="font-bold text-tinta-900 hover:text-laut-700 hover:underline"
                        >
                          {balita.nama}
                        </Link>
                        <span className="angka rounded-md bg-kabut-100 px-2 py-0.5 text-xs font-semibold text-tinta-600">
                          {balita.umurBulan} bln • {balita.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan'}
                        </span>
                      </div>
                      <p className="angka text-xs text-tinta-600">
                        {balita.beratKg} kg • {balita.panjangCm} cm • Diperiksa {formatTanggal(balita.tanggalPeriksa)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <LencanaStatus status={statusBB} ukuran="kecil" />
                      <LencanaStatus status={statusTB} ukuran="kecil" />
                      <Link
                        href={`/balita/${balita.id}`}
                        className="rounded-xl p-2 text-tinta-400 hover:bg-kabut-100 hover:text-tinta-900"
                        title="Buka Profil"
                      >
                        <ChevronRight className="size-4" />
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Quick Links & Modules */}
        <div className="space-y-6">
          {/* Modul Cepat */}
          <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow-kartu)] sm:p-6">
            <h2 className="font-display text-base font-bold text-tinta-900">Modul Kerja</h2>

            <div className="mt-4 space-y-2.5">
              <Link
                href="/balita"
                className="flex items-center justify-between rounded-xl bg-kabut-50 p-3.5 transition-colors hover:bg-laut-50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-laut-100 text-laut-700">
                    <Users className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-tinta-900">Daftar Anak Balita</p>
                    <p className="text-xs text-tinta-600">Pencarian data & riwayat KMS</p>
                  </div>
                </div>
                <ChevronRight className="size-4 text-tinta-400" />
              </Link>

              <Link
                href="/dietisien"
                className="flex items-center justify-between rounded-xl bg-kabut-50 p-3.5 transition-colors hover:bg-karawo-100"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-karawo-100 text-karawo-700">
                    <Utensils className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-tinta-900">Formulasi PKMK</p>
                    <p className="text-xs text-tinta-600">Kalkulator takaran nutrisi</p>
                  </div>
                </div>
                <ChevronRight className="size-4 text-tinta-400" />
              </Link>

              <Link
                href="/rekap"
                className="flex items-center justify-between rounded-xl bg-kabut-50 p-3.5 transition-colors hover:bg-aman-bg"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-aman-bg text-aman-teks">
                    <FileSpreadsheet className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-tinta-900">Rekapitulasi Posyandu</p>
                    <p className="text-xs text-tinta-600">Ekspor Excel & Laporan PDF</p>
                  </div>
                </div>
                <ChevronRight className="size-4 text-tinta-400" />
              </Link>

              {peran === 'admin' && (
                <Link
                  href="/admin/verifikasi"
                  className="flex items-center justify-between rounded-xl bg-tinta-900 p-3.5 text-white transition-opacity hover:opacity-90"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-white/20 text-white">
                      <ShieldCheck className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">Verifikasi Petugas</p>
                      <p className="text-xs text-white/70">Persetujuan pendaftaran</p>
                    </div>
                  </div>
                  <ChevronRight className="size-4" />
                </Link>
              )}
            </div>
          </div>

          {/* Gorontalo Stunting Overview Card */}
          <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow-kartu)] sm:p-6">
            <div className="flex items-center gap-2">
              <BarChart3 className="size-5 text-laut-600" />
              <h2 className="font-display text-base font-bold text-tinta-900">Target Wilayah</h2>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-tinta-600">
              Integrasi posyandu dan puskesmas di Kota Gorontalo, Bone Bolango, Kab. Gorontalo, Boalemo, Pohuwato, dan Gorontalo Utara.
            </p>
            <div className="mt-4 space-y-2 text-xs">
              <div className="flex justify-between border-b border-kabut-100 py-1.5">
                <span className="text-tinta-600">Standar Antropometri</span>
                <span className="font-semibold text-tinta-900">WHO 2006 (0–60 bln)</span>
              </div>
              <div className="flex justify-between border-b border-kabut-100 py-1.5">
                <span className="text-tinta-600">Koreksi Ukur Telentang/Berdiri</span>
                <span className="font-semibold text-tinta-900">± 0,7 cm</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-tinta-600">Target Kalori</span>
                <span className="font-semibold text-tinta-900">Catch-up & Pemeliharaan</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
