'use client'

import { useState, useMemo } from 'react'
import {
  TrendingUp,
  Scale,
  Calendar,
  Baby,
  Sparkles,
  Info,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  HelpCircle,
  ArrowRight,
  Calculator,
} from 'lucide-react'
import { hitungVelocity, selisihHari, hitungUmurKalender } from '@/lib/zscore'
import type { InputVelocity, HasilVelocity } from '@/lib/zscore/tipe'
import { tampilanVelocity } from '@/lib/tampilan/status'
import { formatTanggal } from '@/lib/tampilan/format'
import { SAMPLE_BALITA_DATABASE } from '@/lib/db/balita-mock'

export default function HalamanWeightIncrement() {
  const [mode, setMode] = useState<'pilih_balita' | 'manual'>('pilih_balita')
  const [balitaTerpilihId, setBalitaTerpilihId] = useState<string>(
    SAMPLE_BALITA_DATABASE[0]?.id ?? '',
  )

  // State Form Manual
  const [jenisKelamin, setJenisKelamin] = useState<'lk' | 'pr'>('lk')
  const [tanggalLahir, setTanggalLahir] = useState<string>('2025-06-15')
  const [tanggalAwal, setTanggalAwal] = useState<string>('2026-07-15')
  const [beratAwalKg, setBeratAwalKg] = useState<string>('8.2')
  const [tanggalAkhir, setTanggalAkhir] = useState<string>('2026-08-15')
  const [beratAkhirKg, setBeratAkhirKg] = useState<string>('8.6')

  // Balita terpilih dari mock
  const balita = useMemo(() => {
    return SAMPLE_BALITA_DATABASE.find((b) => b.id === balitaTerpilihId)
  }, [balitaTerpilihId])

  // Hasil perhitungan velocity
  const hasil: HasilVelocity | null = useMemo(() => {
    if (mode === 'pilih_balita' && balita) {
      if (balita.riwayat.length < 2) return null
      const prev = balita.riwayat[balita.riwayat.length - 2]
      const curr = balita.riwayat[balita.riwayat.length - 1]
      return hitungVelocity({
        tanggalLahir: balita.tanggalLahir,
        jenisKelamin: balita.jenisKelamin === 'L' ? 'lk' : 'pr',
        tanggalAwal: prev.tanggal,
        beratAwalKg: prev.beratKg,
        tanggalAkhir: curr.tanggal,
        beratAkhirKg: curr.beratKg,
      })
    }

    const bAwal = Number(beratAwalKg.replace(',', '.'))
    const bAkhir = Number(beratAkhirKg.replace(',', '.'))

    if (
      isNaN(bAwal) ||
      isNaN(bAkhir) ||
      bAwal <= 0 ||
      bAkhir <= 0 ||
      !tanggalLahir ||
      !tanggalAwal ||
      !tanggalAkhir
    ) {
      return null
    }

    return hitungVelocity({
      tanggalLahir,
      jenisKelamin,
      tanggalAwal,
      beratAwalKg: bAwal,
      tanggalAkhir,
      beratAkhirKg: bAkhir,
    })
  }, [
    mode,
    balita,
    tanggalLahir,
    jenisKelamin,
    tanggalAwal,
    beratAwalKg,
    tanggalAkhir,
    beratAkhirKg,
  ])

  const tampilan = hasil ? tampilanVelocity(hasil.status) : null

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-laut-700 via-laut-600 to-cyan-600 p-6 text-white shadow-md sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold backdrop-blur-md">
              <Sparkles className="size-3.5 text-karawo-300" />
              Standar WHO Weight Velocity &amp; Kemenkes RI
            </div>
            <h1 className="font-display text-2xl font-black sm:text-3xl">
              Evaluasi Weight Increment &amp; Growth Faltering
            </h1>
            <p className="max-w-2xl text-xs text-white/90 sm:text-sm leading-relaxed">
              Alat penilaian laju kenaikan berat badan balita antar dua titik penimbangan.
              Mendeteksi perlambatan tumbuh (*Growth Faltering*) seawal mungkin sebelum balita jatuh ke kondisi gizi kurang atau stunting.
            </p>
          </div>
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md">
            <TrendingUp className="size-8 text-white" />
          </div>
        </div>
      </div>

      {/* Mode Pilihan: Pilih dari Database Balita vs Input Manual */}
      <div className="flex flex-wrap items-center gap-2 border-b border-kabut-200 pb-3">
        <button
          type="button"
          onClick={() => setMode('pilih_balita')}
          className={[
            'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all',
            mode === 'pilih_balita'
              ? 'bg-laut-600 text-white shadow-sm'
              : 'bg-white text-tinta-700 hover:bg-kabut-100 ring-1 ring-kabut-200',
          ].join(' ')}
        >
          <Baby className="size-4" />
          Pilih Data Balita Terdaftar
        </button>

        <button
          type="button"
          onClick={() => setMode('manual')}
          className={[
            'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all',
            mode === 'manual'
              ? 'bg-laut-600 text-white shadow-sm'
              : 'bg-white text-tinta-700 hover:bg-kabut-100 ring-1 ring-kabut-200',
          ].join(' ')}
        >
          <Calculator className="size-4" />
          Kalkulator Mandiri (Uji Lapangan)
        </button>
      </div>

      {/* Grid Formulir & Hasil */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Kolom Kiri: Input */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow-kartu)]">
            <h2 className="text-sm font-bold uppercase tracking-wider text-tinta-700 mb-4 flex items-center gap-2">
              <Scale className="size-4 text-laut-600" />
              Parameter Pengukuran
            </h2>

            {mode === 'pilih_balita' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-tinta-700">
                    Pilih Balita
                  </label>
                  <select
                    value={balitaTerpilihId}
                    onChange={(e) => setBalitaTerpilihId(e.target.value)}
                    className="mt-1.5 h-11 w-full rounded-xl border border-kabut-200 bg-white px-3 text-xs font-bold text-tinta-900 focus:border-laut-500 focus:outline-none"
                  >
                    {SAMPLE_BALITA_DATABASE.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.nama} ({b.jenisKelamin === 'L' ? 'L' : 'P'}, {b.riwayat.length}x timbang) — {b.namaPosyandu}
                      </option>
                    ))}
                  </select>
                </div>

                {balita && (
                  <div className="rounded-xl bg-kabut-50 p-4 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-tinta-500">Tanggal Lahir:</span>
                      <span className="font-bold text-tinta-900">{formatTanggal(balita.tanggalLahir)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-tinta-500">Jenis Kelamin:</span>
                      <span className="font-bold text-tinta-900">
                        {balita.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-tinta-500">Jumlah Penimbangan:</span>
                      <span className="font-bold text-tinta-900">{balita.riwayat.length} kali</span>
                    </div>

                    {balita.riwayat.length >= 2 && (
                      <div className="mt-3 border-t border-kabut-200 pt-2 space-y-1.5">
                        <p className="font-bold text-tinta-700 text-[11px] uppercase">
                          2 Titik Penimbangan Terakhir:
                        </p>
                        <div className="flex justify-between text-tinta-600">
                          <span>1. {formatTanggal(balita.riwayat[balita.riwayat.length - 2].tanggal)}:</span>
                          <span className="font-bold text-tinta-900">
                            {balita.riwayat[balita.riwayat.length - 2].beratKg} kg
                          </span>
                        </div>
                        <div className="flex justify-between text-tinta-600">
                          <span>2. {formatTanggal(balita.riwayat[balita.riwayat.length - 1].tanggal)}:</span>
                          <span className="font-bold text-laut-700">
                            {balita.riwayat[balita.riwayat.length - 1].beratKg} kg
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                {/* Jenis Kelamin */}
                <div>
                  <label className="block font-bold text-tinta-700">Jenis Kelamin</label>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setJenisKelamin('lk')}
                      className={[
                        'flex items-center justify-center gap-2 rounded-xl py-2.5 font-bold transition-all',
                        jenisKelamin === 'lk'
                          ? 'bg-sky-100 text-sky-900 ring-2 ring-sky-500'
                          : 'bg-kabut-50 text-tinta-600 hover:bg-kabut-100',
                      ].join(' ')}
                    >
                      👦 Laki-laki
                    </button>
                    <button
                      type="button"
                      onClick={() => setJenisKelamin('pr')}
                      className={[
                        'flex items-center justify-center gap-2 rounded-xl py-2.5 font-bold transition-all',
                        jenisKelamin === 'pr'
                          ? 'bg-rose-100 text-rose-900 ring-2 ring-rose-500'
                          : 'bg-kabut-50 text-tinta-600 hover:bg-kabut-100',
                      ].join(' ')}
                    >
                      👧 Perempuan
                    </button>
                  </div>
                </div>

                {/* Tanggal Lahir */}
                <div>
                  <label className="block font-bold text-tinta-700">Tanggal Lahir Balita</label>
                  <input
                    type="date"
                    value={tanggalLahir}
                    onChange={(e) => setTanggalLahir(e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-kabut-200 bg-white px-3 font-semibold text-tinta-900 focus:border-laut-500 focus:outline-none"
                  />
                </div>

                {/* Penimbangan Sebelumnya (T1) */}
                <div className="rounded-xl border border-kabut-200 bg-kabut-50/50 p-3 space-y-3">
                  <p className="font-bold text-tinta-800 text-xs">
                    Titik Awal (Penimbangan Sebelumnya / T1)
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-tinta-600">Tanggal T1</label>
                      <input
                        type="date"
                        value={tanggalAwal}
                        onChange={(e) => setTanggalAwal(e.target.value)}
                        className="mt-1 h-10 w-full rounded-lg border border-kabut-200 bg-white px-2.5 text-xs font-semibold text-tinta-900 focus:border-laut-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-tinta-600">Berat T1 (kg)</label>
                      <input
                        type="text"
                        value={beratAwalKg}
                        onChange={(e) => setBeratAwalKg(e.target.value)}
                        placeholder="Contoh: 8.2"
                        className="mt-1 h-10 w-full rounded-lg border border-kabut-200 bg-white px-2.5 text-xs font-bold text-tinta-900 focus:border-laut-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Penimbangan Sekarang (T2) */}
                <div className="rounded-xl border border-laut-200 bg-laut-50/30 p-3 space-y-3">
                  <p className="font-bold text-laut-900 text-xs">
                    Titik Akhir (Penimbangan Sekarang / T2)
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-tinta-600">Tanggal T2</label>
                      <input
                        type="date"
                        value={tanggalAkhir}
                        onChange={(e) => setTanggalAkhir(e.target.value)}
                        className="mt-1 h-10 w-full rounded-lg border border-kabut-200 bg-white px-2.5 text-xs font-semibold text-tinta-900 focus:border-laut-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-tinta-600">Berat T2 (kg)</label>
                      <input
                        type="text"
                        value={beratAkhirKg}
                        onChange={(e) => setBeratAkhirKg(e.target.value)}
                        placeholder="Contoh: 8.6"
                        className="mt-1 h-10 w-full rounded-lg border border-kabut-200 bg-white px-2.5 text-xs font-bold text-tinta-900 focus:border-laut-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Panduan Klinis Singkat */}
          <div className="rounded-2xl bg-kabut-50 p-4 ring-1 ring-kabut-200 text-xs space-y-2 text-tinta-600">
            <p className="font-bold text-tinta-900 flex items-center gap-1.5">
              <Info className="size-4 text-laut-600" />
              Kriteria Penilaian Weight Increment:
            </p>
            <ul className="list-disc pl-4 space-y-1 text-[11px] leading-relaxed">
              <li>
                <strong>Interval Sahih WHO:</strong> Jarak penimbangan 21 hingga 110 hari (dikelompokkan ke interval 1, 2, atau 3 bulan).
              </li>
              <li>
                <strong>Persentil 5 (P5):</strong> Batas minimal kenaikan gram agar balita tidak tergolong mengalami perlambatan tumbuh (*Growth Faltering*).
              </li>
              <li>
                <strong>Kenaikan Berat Minimal (KBM):</strong> Standar acuan kenaikan berat badan bulanan pada Buku KIA / KMS Kemenkes.
              </li>
            </ul>
          </div>
        </div>

        {/* Kolom Kanan: Hasil Analisis & Status */}
        <div className="lg:col-span-7 space-y-4">
          {hasil ? (
            <div className="space-y-4">
              {/* Kartu Status Utama */}
              <div
                className={[
                  'rounded-2xl p-6 shadow-sm ring-1 transition-all',
                  hasil.status === 'naik'
                    ? 'bg-emerald-50/80 ring-emerald-300'
                    : hasil.status === 'growth_faltering'
                      ? 'bg-amber-50/80 ring-amber-300'
                      : hasil.status === 'tidak_naik'
                        ? 'bg-rose-50/80 ring-rose-300'
                        : 'bg-kabut-50 ring-kabut-200',
                ].join(' ')}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={[
                        'flex size-12 items-center justify-center rounded-2xl text-white shadow-sm',
                        hasil.status === 'naik'
                          ? 'bg-emerald-600'
                          : hasil.status === 'growth_faltering'
                            ? 'bg-amber-500'
                            : hasil.status === 'tidak_naik'
                              ? 'bg-rose-600'
                              : 'bg-tinta-400',
                      ].join(' ')}
                    >
                      {hasil.status === 'naik' ? (
                        <CheckCircle2 className="size-7" />
                      ) : hasil.status === 'growth_faltering' ? (
                        <AlertTriangle className="size-7" />
                      ) : hasil.status === 'tidak_naik' ? (
                        <AlertOctagon className="size-7" />
                      ) : (
                        <HelpCircle className="size-7" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-tinta-500">
                        Status Kenaikan Berat Badan
                      </p>
                      <h3 className="font-display text-xl font-black text-tinta-900 sm:text-2xl">
                        {tampilan?.label}
                      </h3>
                    </div>
                  </div>

                  <span
                    className={[
                      'rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider',
                      hasil.status === 'naik'
                        ? 'bg-emerald-200 text-emerald-900'
                        : hasil.status === 'growth_faltering'
                          ? 'bg-amber-200 text-amber-900'
                          : hasil.status === 'tidak_naik'
                            ? 'bg-rose-200 text-rose-900'
                            : 'bg-kabut-200 text-tinta-700',
                    ].join(' ')}
                  >
                    {hasil.status === 'naik'
                      ? 'N (Naik)'
                      : hasil.status === 'tidak_dapat_dinilai'
                        ? '-'
                        : 'T (Tidak Naik)'}
                  </span>
                </div>

                <p className="mt-3 text-xs text-tinta-700 leading-relaxed font-medium">
                  {tampilan?.keterangan}
                </p>

                {hasil.alasan && (
                  <p className="mt-2 rounded-lg bg-white/70 p-2.5 text-xs text-tinta-600 ring-1 ring-black/5">
                    <strong>Catatan:</strong> {hasil.alasan}
                  </p>
                )}
              </div>

              {/* Rincian Angka & Komparasi KBM */}
              <div className="grid gap-3 sm:grid-cols-3">
                {/* 1. Kenaikan Aktual */}
                <div className="rounded-2xl bg-white p-4 shadow-[var(--shadow-kartu)]">
                  <p className="text-xs text-tinta-500 font-semibold">Kenaikan Berat Riil</p>
                  <p
                    className={[
                      'angka mt-1 text-2xl font-black',
                      hasil.kenaikanAktualGram > 0
                        ? 'text-emerald-700'
                        : hasil.kenaikanAktualGram === 0
                          ? 'text-tinta-700'
                          : 'text-rose-700',
                    ].join(' ')}
                  >
                    {hasil.kenaikanAktualGram > 0 ? `+${hasil.kenaikanAktualGram}` : hasil.kenaikanAktualGram} g
                  </p>
                  <p className="text-[11px] text-tinta-400 mt-0.5">
                    ({(hasil.kenaikanAktualGram / 1000).toFixed(2)} kg)
                  </p>
                </div>

                {/* 2. Target Minimal P5 */}
                <div className="rounded-2xl bg-white p-4 shadow-[var(--shadow-kartu)]">
                  <p className="text-xs text-tinta-500 font-semibold">Target Minimal (WHO P5)</p>
                  <p className="angka mt-1 text-2xl font-black text-laut-700">
                    {hasil.kenaikanMinimalGram !== null
                      ? `+${hasil.kenaikanMinimalGram} g`
                      : '-'}
                  </p>
                  <p className="text-[11px] text-tinta-400 mt-0.5">
                    {hasil.kenaikanMinimalGram !== null
                      ? `Min ${(hasil.kenaikanMinimalGram / 1000).toFixed(2)} kg`
                      : 'Di luar rentang'}
                  </p>
                </div>

                {/* 3. Selisih Hari Antara Pengukuran */}
                <div className="rounded-2xl bg-white p-4 shadow-[var(--shadow-kartu)]">
                  <p className="text-xs text-tinta-500 font-semibold">Jarak Pengukuran</p>
                  <p className="angka mt-1 text-2xl font-black text-tinta-900">
                    {hasil.selisihHari} hari
                  </p>
                  <p className="text-[11px] text-tinta-400 mt-0.5">
                    Umur awal: {hasil.umurAwalBulan} bln
                  </p>
                </div>
              </div>

              {/* Rincian Metode & Rekomendasi Alur Tindakan */}
              <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow-kartu)] space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-tinta-700">
                  Rekomendasi Tindak Lanjut Lapangan
                </h4>

                {hasil.status === 'naik' && (
                  <div className="rounded-xl bg-emerald-50 p-3.5 text-xs text-emerald-900 space-y-1">
                    <p className="font-bold">✅ Pertumbuhan Sesuai Harapan (N):</p>
                    <p className="leading-relaxed">
                      Pertahankan pola asuh, ASI eksklusif / MPASI adekuat, dan anjurkan penimbangan rutin pada jadwal Posyandu bulan berikutnya.
                    </p>
                  </div>
                )}

                {hasil.status === 'growth_faltering' && (
                  <div className="rounded-xl bg-amber-50 p-3.5 text-xs text-amber-900 space-y-1.5">
                    <p className="font-bold">⚠️ Deteksi Dini Growth Faltering (T):</p>
                    <p className="leading-relaxed">
                      Berat badan balita bertambah namun tidak mencapai ambang persentil 5 baku WHO (+{hasil.kenaikanMinimalGram} g). Ini merupakan indikator awal gagal tumbuh sebelum stunting.
                    </p>
                    <p className="font-semibold text-amber-800">
                      Tindakan: Lakukan konseling gizi dan evaluasi asupan makan (MPASI/ASI), cek riwayat sakit atau infeksi berulang, dan jadwalkan evaluasi ulang dalam 2 minggu.
                    </p>
                  </div>
                )}

                {hasil.status === 'tidak_naik' && (
                  <div className="rounded-xl bg-rose-50 p-3.5 text-xs text-rose-900 space-y-1.5">
                    <p className="font-bold">🚨 Berat Badan Tidak Naik / Turun (T):</p>
                    <p className="leading-relaxed">
                      Berat badan balita menetap atau mengalami penurunan dibandingkan penimbangan sebelumnya.
                    </p>
                    <p className="font-semibold text-rose-800">
                      Tindakan: Rujuk ke Tenaga Medis / Dokter Puskesmas untuk pelacakan penyakit penyerta (infeksi kronis, TBC, ISPA, diare) dan asesmen nutrisi lengkap bersama Dietisien.
                    </p>
                  </div>
                )}

                <div className="text-[11px] text-tinta-400 pt-2 border-t border-kabut-100 flex items-center justify-between">
                  <span>Metode: {hasil.metode}</span>
                  <span>Formula LMS WHO P5 - Delta Terkoreksi</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-64 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-kabut-200 bg-white p-6 text-center text-tinta-400">
              <Scale className="size-10 text-kabut-400 mb-2" />
              <p className="font-bold text-tinta-700">Data Pengukuran Belum Lengkap</p>
              <p className="text-xs text-tinta-500 max-w-sm mt-1">
                Pilih balita dengan minimal 2 riwayat penimbangan atau lengkapi input tanggal dan berat badan pada kalkulator mandiri.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
