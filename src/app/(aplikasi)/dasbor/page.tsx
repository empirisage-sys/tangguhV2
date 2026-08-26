import Link from 'next/link'
import { ambilProfil } from '@/lib/supabase/penjaga'
import { SAMPLE_BALITA_DATABASE } from '@/lib/db/balita-mock'
import { ambilSemuaRujukan } from '@/lib/db/rujukan'
import { bolehLihatBalita } from '@/lib/tampilan/akses'
import {
  Activity,
  AlertTriangle,
  Baby,
  BarChart3,
  ChevronRight,
  FileSpreadsheet,
  HeartPulse,
  Plus,
  ShieldCheck,
  Sparkles,
  Users,
  Utensils,
  Stethoscope,
} from 'lucide-react'
import { LencanaStatus } from '@/components/ui/LencanaStatus'
import { tampilanBBTB, tampilanTBU } from '@/lib/tampilan/status'
import { formatTanggal } from '@/lib/tampilan/format'

export default async function DasborPage() {
  const profil = await ambilProfil()
  const daftarRujukan = ambilSemuaRujukan()
  const peran = profil?.peran ?? 'kader'
  const nama = profil?.namaLengkap ?? 'Pengguna TANGGUH'
  const jenisFaskes = profil?.jenisFaskes ?? 'puskesmas'

  // Filter balita sesuai hak akses klinis
  const balitaList = SAMPLE_BALITA_DATABASE.filter((b) => {
    if (profil && !bolehLihatBalita(b, profil, daftarRujukan)) return false
    return true
  })

  const totalBalita = balitaList.length
  let totalDitimbangBulanIni = 0
  let totalStuntingWasting = 0
  let totalRedFlag = 0

  const sekarang = new Date()
  const bulanIni = `${sekarang.getFullYear()}-${String(sekarang.getMonth() + 1).padStart(2, '0')}`

  for (const b of balitaList) {
    const s = b.riwayat[b.riwayat.length - 1]
    if (s) {
      if (s.tanggal.startsWith(bulanIni)) {
        totalDitimbangBulanIni++
      }
      const isStunting = s.statusTBU === 'pendek' || s.statusTBU === 'sangat_pendek'
      const isWasting = s.statusBBTB === 'gizi_kurang' || s.statusBBTB === 'gizi_buruk'
      if (isStunting || isWasting) {
        totalStuntingWasting++
      }
      if (s.statusBBTB === 'gizi_buruk' || s.statusTBU === 'sangat_pendek' || s.edema) {
        totalRedFlag++
      }
    }
  }

  // Pengukuran terbaru
  const balitaTerbaru = balitaList
    .filter((b) => b.riwayat.length > 0)
    .sort((a, b) => {
      const tA = a.riwayat[a.riwayat.length - 1]?.tanggal ?? ''
      const tB = b.riwayat[b.riwayat.length - 1]?.tanggal ?? ''
      return tB.localeCompare(tA)
    })
    .slice(0, 5)

  const labelPeran =
    peran === 'admin'
      ? 'Administrator'
      : peran === 'dokter_spesialis_anak'
      ? 'Dokter Spesialis Anak'
      : peran === 'dokter'
      ? jenisFaskes === 'rumah_sakit'
        ? 'Dokter Rumah Sakit'
        : 'Dokter Puskesmas'
      : peran === 'dietisien'
      ? 'Dietisien Puskesmas'
      : 'Kader Posyandu'

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-laut-700 via-laut-600 to-laut-500 p-6 text-white shadow-lg shadow-laut-600/15 sm:p-8">
        <div className="relative z-10 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white backdrop-blur-md">
              <Sparkles className="size-3.5 text-karawo-400" />
              <span>Peran: {labelPeran}</span>
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
          <p className="angka mt-3 text-2xl font-bold text-tinta-900 sm:text-3xl">{totalBalita}</p>
          <p className="text-xs font-semibold text-tinta-600">Balita Terdaftar</p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow-kartu)]">
          <div className="flex size-10 items-center justify-center rounded-xl bg-aman-bg text-aman-teks">
            <Activity className="size-5" />
          </div>
          <p className="angka mt-3 text-2xl font-bold text-aman-teks sm:text-3xl">{totalDitimbangBulanIni}</p>
          <p className="text-xs font-semibold text-tinta-600">Ditimbang Bulan Ini</p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow-kartu)]">
          <div className="flex size-10 items-center justify-center rounded-xl bg-waspada-bg text-waspada-teks">
            <AlertTriangle className="size-5" />
          </div>
          <p className="angka mt-3 text-2xl font-bold text-waspada-teks sm:text-3xl">{totalStuntingWasting}</p>
          <p className="text-xs font-semibold text-tinta-600">Pendek / Wasted</p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow-kartu)]">
          <div className="flex size-10 items-center justify-center rounded-xl bg-bahaya-bg text-bahaya-teks">
            <HeartPulse className="size-5" />
          </div>
          <p className="angka mt-3 text-2xl font-bold text-bahaya-teks sm:text-3xl">{totalRedFlag}</p>
          <p className="text-xs font-semibold text-tinta-600">Perlu Rujukan (Red Flag)</p>
        </div>
      </div>

      {/* Main Sections */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Screening History & Urgent Items */}
        <div className="space-y-6 lg:col-span-2">
          {/* Action Alert Banner (Hanya muncul jika ada red flag aktif) */}
          {totalRedFlag > 0 && (
            <div className="rounded-2xl bg-bahaya-bg p-5 ring-1 ring-bahaya-garis">
              <div className="flex items-start gap-3">
                <HeartPulse className="size-5 shrink-0 text-bahaya-teks" />
                <div className="flex-1">
                  <h2 className="text-sm font-bold text-bahaya-teks">
                    {totalRedFlag} Balita Memerlukan Intervensi & Rujukan Segera
                  </h2>
                  <p className="mt-1 text-xs text-bahaya-teks/90">
                    Ditemukan balita dengan status Gizi Buruk (BB/TB &lt; -3 SD) atau Stunting Berat pada penimbangan terakhir.
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
          )}

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

            {balitaTerbaru.length === 0 ? (
              <div className="mt-4 rounded-xl bg-kabut-50 p-8 text-center text-xs text-tinta-500 space-y-2">
                <Baby className="mx-auto size-8 text-tinta-300" />
                <p className="font-bold text-tinta-800">Belum Ada Pengukuran Balita</p>
                <p>Mulai catat pertumbuhan balita pertama di wilayah binaan Anda.</p>
                <div className="pt-2">
                  <Link
                    href="/balita/baru"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-laut-600 px-4 py-2 text-xs font-bold text-white hover:bg-laut-700 transition-colors"
                  >
                    <Plus className="size-3.5" />
                    Tambah Balita Baru
                  </Link>
                </div>
              </div>
            ) : (
              <div className="mt-4 divide-y divide-kabut-100">
                {balitaTerbaru.map((balita) => {
                  const skriningAkhir = balita.riwayat[balita.riwayat.length - 1]
                  if (!skriningAkhir) return null

                  const statusBB = tampilanBBTB(skriningAkhir.statusBBTB)
                  const statusTB = tampilanTBU(skriningAkhir.statusTBU)

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
                            {skriningAkhir.umurBulan} bln • {balita.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan'}
                          </span>
                        </div>
                        <p className="angka text-xs text-tinta-600">
                          {skriningAkhir.beratKg} kg • {skriningAkhir.panjangCm} cm • Diperiksa {formatTanggal(skriningAkhir.tanggal)}
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
            )}
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
