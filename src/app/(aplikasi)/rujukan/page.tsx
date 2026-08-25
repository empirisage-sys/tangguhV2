'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  Baby,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Filter,
  Hospital,
  Lock,
  Plus,
  Search,
  Send,
  Sparkles,
  Stethoscope,
  Utensils,
} from 'lucide-react'
import {
  ambilSemuaRujukan,
  type RujukanDetail,
  type StatusRujukan,
} from '@/lib/db/rujukan'
import { formatTanggal } from '@/lib/tampilan/format'
import { ModalBalasanRujukan } from '@/components/rujukan/ModalBalasanRujukan'

export default function HalamanPasienRujukan() {
  const [daftarRujukan, setDaftarRujukan] = useState<RujukanDetail[]>(ambilSemuaRujukan())
  const [filterStatus, setFilterStatus] = useState<StatusRujukan | 'semua'>('semua')
  const [kueriCari, setKueriCari] = useState<string>('')
  const [rujukanDipilih, setRujukanDipilih] = useState<RujukanDetail | null>(null)
  const [modalBalasBuka, setModalBalasBuka] = useState<boolean>(false)

  // Statistik Ringkas
  const totalRujukan = daftarRujukan.length
  const totalMenunggu = daftarRujukan.filter((r) => r.status === 'diajukan').length
  const totalDitangani = daftarRujukan.filter((r) => r.status === 'diterima').length
  const totalSelesai = daftarRujukan.filter((r) => r.status === 'selesai').length

  // Filter & Pencarian
  const rujukanTerfilter = useMemo(() => {
    return daftarRujukan.filter((r) => {
      if (filterStatus !== 'semua' && r.status !== filterStatus) return false
      if (kueriCari.trim()) {
        const q = kueriCari.toLowerCase()
        const cocokNama = r.namaBalita.toLowerCase().includes(q)
        const cocokNik = r.nik?.toLowerCase().includes(q) || false
        const cocokPuskesmas = r.namaPuskesmas.toLowerCase().includes(q)
        const cocokRs = r.namaRsTujuan.toLowerCase().includes(q)
        if (!cocokNama && !cocokNik && !cocokPuskesmas && !cocokRs) return false
      }
      return true
    })
  }, [daftarRujukan, filterStatus, kueriCari])

  const handleBalasanSukses = (updated: RujukanDetail) => {
    setDaftarRujukan(ambilSemuaRujukan())
  }

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-laut-600 text-white shadow-md shadow-laut-600/20">
              <Hospital className="size-5" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-tinta-900">
                Pasien Rujukan Medis
              </h1>
              <p className="text-xs text-tinta-600">
                Alur Kolaborasi Berjenjang Posyandu ➔ Puskesmas ➔ RSUD ➔ Rujuk Balik
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
            <Lock className="size-3.5 text-emerald-600" />
            Akses Rekam Medis Terbuka 90 Hari
          </span>
        </div>
      </div>

      {/* Banner Penjelasan Alur Klinis Sesuai Pedoman TANGGUH */}
      <div className="rounded-2xl bg-gradient-to-r from-laut-800 via-laut-700 to-cyan-700 p-5 text-white shadow-md">
        <div className="flex items-start gap-3.5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md">
            <Sparkles className="size-5 text-white" />
          </div>
          <div className="space-y-1 text-xs">
            <h2 className="font-display text-sm font-bold sm:text-base">
              Proses Rujukan Terintegrasi Tanpa Putus Data
            </h2>
            <p className="text-white/90 leading-relaxed">
              Dokter Spesialis di RSUD dapat langsung membuka profil balita untuk membaca <strong>seluruh riwayat penimbangan sejak lahir</strong> dan <strong>kurva pertumbuhan WHO lengkap</strong> (bukan hanya satu titik), mencatat skrining baru pada riwayat yang sama, serta mengisi catatan balasan rujuk balik ke Puskesmas.
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards Ringkasan */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl bg-white p-4 shadow-[var(--shadow-kartu)] border border-kabut-200">
          <p className="text-xs font-bold uppercase tracking-wider text-tinta-400">Total Pasien Rujukan</p>
          <p className="angka mt-1.5 text-2xl font-black text-tinta-900">{totalRujukan}</p>
          <p className="mt-1 text-[11px] text-tinta-500">Seluruh kasus rujukan aktif</p>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-[var(--shadow-kartu)] border border-amber-200 bg-amber-50/30">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Menunggu Respon RS</p>
          <p className="angka mt-1.5 text-2xl font-black text-amber-800">{totalMenunggu}</p>
          <p className="mt-1 text-[11px] text-amber-700 font-semibold">Perlu telaah spesialis anak</p>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-[var(--shadow-kartu)] border border-sky-200 bg-sky-50/30">
          <p className="text-xs font-bold uppercase tracking-wider text-sky-700">Sedang Ditangani RS</p>
          <p className="angka mt-1.5 text-2xl font-black text-sky-800">{totalDitangani}</p>
          <p className="mt-1 text-[11px] text-sky-700 font-semibold">Dalam rawat inap / jalan</p>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-[var(--shadow-kartu)] border border-emerald-200 bg-emerald-50/30">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Selesai (Rujuk Balik)</p>
          <p className="angka mt-1.5 text-2xl font-black text-emerald-800">{totalSelesai}</p>
          <p className="mt-1 text-[11px] text-emerald-700 font-semibold">Tatalaksana &amp; PKMK dikirim</p>
        </div>
      </div>

      {/* Toolbar Filter & Pencarian */}
      <div className="flex flex-col justify-between gap-3 rounded-2xl bg-white p-4 shadow-[var(--shadow-kartu)] sm:flex-row sm:items-center">
        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-1.5 text-xs">
          {[
            { id: 'semua', label: 'Semua Rujukan' },
            { id: 'diajukan', label: '⏳ Menunggu RS' },
            { id: 'diterima', label: '🏥 Ditangani RS' },
            { id: 'selesai', label: '✅ Selesai (Rujuk Balik)' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterStatus(tab.id as StatusRujukan | 'semua')}
              className={[
                'rounded-xl px-3.5 py-2 font-bold transition-all cursor-pointer',
                filterStatus === tab.id
                  ? 'bg-laut-600 text-white shadow-sm'
                  : 'bg-kabut-100 text-tinta-700 hover:bg-kabut-200',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Input Pencarian */}
        <div className="relative min-w-[260px]">
          <Search className="pointer-events-none absolute left-3.5 top-3 size-4 text-tinta-400" />
          <input
            type="text"
            value={kueriCari}
            onChange={(e) => setKueriCari(e.target.value)}
            placeholder="Cari balita, NIK, puskesmas..."
            className="h-10 w-full rounded-xl border border-kabut-200 bg-white pl-9 pr-4 text-xs font-semibold text-tinta-900 focus:border-laut-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Daftar Kartu Pasien Rujukan */}
      <div className="space-y-4">
        {rujukanTerfilter.length === 0 ? (
          <div className="rounded-2xl bg-white p-12 text-center shadow-[var(--shadow-kartu)] space-y-2">
            <Hospital className="mx-auto size-10 text-tinta-300" />
            <p className="font-display text-base font-bold text-tinta-900">
              Belum Ada Pasien Rujukan
            </p>
            <p className="text-xs text-tinta-500">
              {kueriCari || filterStatus !== 'semua'
                ? 'Ubah kueri pencarian atau tab status rujukan untuk melihat data lainnya.'
                : 'Puskesmas dapat menerbitkan rujukan untuk balita berisiko tinggi (gizi buruk atau stunting) ke Rumah Sakit.'}
            </p>
          </div>
        ) : (
          rujukanTerfilter.map((r) => (
            <div
              key={r.id}
              className="rounded-2xl border border-kabut-200 bg-white p-5 shadow-[var(--shadow-kartu)] transition-all hover:shadow-md space-y-4"
            >
              {/* Header Kartu Rujukan */}
              <div className="flex flex-col justify-between gap-3 border-b border-kabut-200 pb-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-laut-50 text-laut-700 font-bold">
                    {r.jenisKelamin === 'L' ? '👦' : '👧'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/balita/${r.balitaId}`}
                        className="font-display text-base font-bold text-laut-900 hover:text-laut-700 transition-colors"
                      >
                        {r.namaBalita}
                      </Link>
                      <span
                        className={[
                          'rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase',
                          r.jenisKelamin === 'L'
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-rose-100 text-rose-800',
                        ].join(' ')}
                      >
                        {r.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan'} • {r.umurBulan} Bulan
                      </span>
                    </div>
                    <p className="text-xs text-tinta-500">
                      Asal: <strong className="text-tinta-800">{r.namaPuskesmas}</strong> ({r.namaKabupaten})
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={[
                      'rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider',
                      r.status === 'diajukan'
                        ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-300'
                        : r.status === 'diterima'
                        ? 'bg-sky-100 text-sky-800 ring-1 ring-sky-300'
                        : 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300',
                    ].join(' ')}
                  >
                    {r.status === 'diajukan'
                      ? '⏳ Diajukan ke RSUD'
                      : r.status === 'diterima'
                      ? '🏥 Sedang Ditangani RS'
                      : '✅ Selesai (Rujuk Balik)'}
                  </span>
                </div>
              </div>

              {/* Rincian Rujukan */}
              <div className="grid gap-3 text-xs sm:grid-cols-2">
                {/* Kolom Kiri: Info Rujukan Puskesmas */}
                <div className="rounded-xl bg-kabut-50 p-3.5 ring-1 ring-kabut-200 space-y-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="font-bold text-tinta-400 uppercase">RSUD Tujuan:</span>
                    <span className="font-bold text-laut-800">{r.namaRsTujuan}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-tinta-700">Diagnosis Awal:</span>
                    <p className="font-bold text-tinta-900">{r.diagnosisAwal}</p>
                  </div>
                  <div>
                    <span className="font-semibold text-tinta-700">Alasan Rujukan:</span>
                    <p className="text-tinta-600 leading-relaxed">{r.alasanRujukan}</p>
                  </div>
                  <div className="border-t border-kabut-200 pt-1 text-[11px] text-tinta-400 flex justify-between">
                    <span>Pengaju: {r.diajukanOlehNama}</span>
                    <span>Tgl: {formatTanggal(r.tanggalPengajuan)}</span>
                  </div>
                </div>

                {/* Kolom Kanan: Respon & Catatan Balasan Spesialis RS */}
                <div
                  className={[
                    'rounded-xl p-3.5 ring-1 space-y-1.5',
                    r.status === 'selesai'
                      ? 'bg-emerald-50/70 ring-emerald-200 text-emerald-950'
                      : 'bg-amber-50/50 ring-amber-200 text-amber-950',
                  ].join(' ')}
                >
                  <div className="flex justify-between text-[11px]">
                    <span className="font-bold uppercase tracking-wider text-emerald-800">
                      {r.status === 'selesai'
                        ? 'Catatan Balasan Spesialis RSUD'
                        : 'Status Penanganan di RSUD'}
                    </span>
                    <span className="font-bold">
                      {r.tanggalSelesai ? formatTanggal(r.tanggalSelesai) : 'Dalam Proses'}
                    </span>
                  </div>

                  {r.status === 'selesai' && r.catatanBalasan ? (
                    <>
                      <div>
                        <span className="font-semibold text-emerald-800">Dokter &amp; Diagnosis:</span>
                        <p className="font-bold text-emerald-950">
                          {r.namaDokterSpesialis}: {r.diagnosisDefinitifRS}
                        </p>
                      </div>
                      <p className="text-emerald-900 leading-relaxed text-xs">
                        {r.catatanBalasan}
                      </p>
                      {r.rekomendasiPKMK && (
                        <div className="rounded-lg bg-white/90 p-2 text-[11px] ring-1 ring-emerald-300">
                          <strong className="text-emerald-900">Rekomendasi PKMK:</strong>{' '}
                          {r.rekomendasiPKMK}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col justify-center h-28 text-center space-y-1.5">
                      <Clock className="mx-auto size-6 text-amber-600" />
                      <p className="font-bold text-amber-900">
                        Menunggu telaah medis &amp; peresepan PKMK
                      </p>
                      <p className="text-[11px] text-amber-800">
                        Dokter spesialis anak RSUD dapat membuka profil rekam medis dan mengisi tatalaksana.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Tombol Aksi Kolaboratif */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-kabut-200 pt-3">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-tinta-500">
                  <Lock className="size-3 text-emerald-600" />
                  <span>Akses kurva pertumbuhan sejak lahir terbuka (90 hari)</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRujukanDipilih(r)
                      setModalBalasBuka(true)
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-kabut-200 bg-white px-3.5 py-2 text-xs font-bold text-tinta-800 shadow-sm hover:bg-kabut-100 transition-colors"
                  >
                    <Stethoscope className="size-3.5 text-laut-600" />
                    {r.status === 'selesai' ? 'Ubah Catatan Balasan RS' : 'Tanggapi / Rujuk Balik'}
                  </button>

                  <Link
                    href={`/balita/${r.balitaId}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-laut-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-laut-700 transition-all active:scale-95"
                  >
                    <span>Buka Profil &amp; Kurva WHO Lengkap</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Balasan Rujukan */}
      {rujukanDipilih && (
        <ModalBalasanRujukan
          rujukan={rujukanDipilih}
          terbuka={modalBalasBuka}
          onTutup={() => {
            setModalBalasBuka(false)
            setRujukanDipilih(null)
          }}
          onSukses={(updated) => {
            handleBalasanSukses(updated)
            setModalBalasBuka(false)
            setRujukanDipilih(null)
          }}
        />
      )}
    </div>
  )
}
