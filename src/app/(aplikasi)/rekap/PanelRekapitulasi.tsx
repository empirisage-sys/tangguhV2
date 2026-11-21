'use client'

import { useMemo, useState } from 'react'
import { hitungRekap, persen } from '@/lib/rekap/agregat'
import {
  BarChart3,
  Calendar,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  MapPin,
  Sparkles,
  TrendingDown,
} from 'lucide-react'
import { KABUPATEN_GORONTALO } from '@/lib/db/wilayah'
import type { BalitaDetail } from '@/lib/db/balita'
import { Button } from '@/components/ui/Button'

/**
 * Panel rekapitulasi.
 *
 * ==========================================================================
 * TAHAP 2a: ANGKA REKAP DIBACA DARI SUPABASE
 *
 * Seluruh angka di halaman ini — total balita, total skrining, prevalensi
 * stunting, wasting, dan penanda rujukan — dahulu dihitung dari
 * `SAMPLE_BALITA_DATABASE` yang isinya `[]`. Jadi laporan rekapitulasi SELALU
 * menampilkan 0 balita dan prevalensi 0,0%, dan angka itu tampak seperti hasil
 * hitung yang sah. Untuk laporan program, nol yang salah lebih berbahaya
 * daripada layar kosong.
 *
 * Pembacaannya dilakukan komponen server `page.tsx` di folder ini.
 * ==========================================================================
 */
export function PanelRekapitulasi({
  daftarBalita,
  galatBaca,
}: {
  daftarBalita: BalitaDetail[]
  galatBaca: string | null
}) {
  // Bulan bawaan: bulan berjalan menurut jam perangkat. Dahulu dipatok
  // '2026-08' dan kabupaten 'kab-7571', dan keduanya tidak dipakai menghitung.
  const [kabupaten, setKabupaten] = useState<string>('semua')
  const [bulan, setBulan] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [sedangUnduh, setSedangUnduh] = useState<boolean>(false)

  const rekap = useMemo(() => hitungRekap(daftarBalita, { bulan, kabupaten }), [daftarBalita, bulan, kabupaten])
  const totalBalita = rekap.balitaDitimbang
  const totalSkrining = rekap.jumlahPengukuran
  const countStunting = rekap.stunting
  const countWasting = rekap.wasting
  const countRedFlag = rekap.rujukan
  const tampilPersen = (n: number | null) =>
    n === null ? '–' : n.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const pStunting = tampilPersen(persen(countStunting, totalBalita))
  const pWasting = tampilPersen(persen(countWasting, totalBalita))
  const pRedFlag = tampilPersen(persen(countRedFlag, totalBalita))
  const pilihanKabupaten = useMemo(() => {
    const nama = new Set<string>(KABUPATEN_GORONTALO.map((k) => k.nama))
    for (const b of daftarBalita) if (b.namaKabupaten) nama.add(b.namaKabupaten)
    return [...nama].sort()
  }, [daftarBalita])

  const unduhExcel = async () => {
    setSedangUnduh(true)
    try {
      const response = await fetch('/api/ekspor/excel')
      // Dahulu jawaban galat (mis. "tidak ada balita", 404) ikut diunduh
      // sebagai berkas .xlsx berisi JSON yang tidak dapat dibuka.
      if (!response.ok) {
        const isi = await response.json().catch(() => null)
        window.alert(isi?.error ?? 'Berkas Excel belum dapat dibuat. Coba lagi.')
        return
      }
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      // Berkas Excel memuat SELURUH data dalam cakupan, tidak mengikuti filter.
      a.download = `Data_TANGGUH_Gorontalo_${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
    } finally {
      setSedangUnduh(false)
    }
  }

  return (
    <div className="space-y-6">
      {/*
        Prevalensi 0,0% karena database menolak TIDAK BOLEH tampil sama dengan
        prevalensi 0,0% karena wilayahnya memang bersih. Yang pertama laporan
        yang salah, yang kedua kabar baik.
      */}
      {galatBaca && (
        <div className="rounded-2xl border-2 border-bahaya-garis bg-bahaya-bg p-4 text-xs text-bahaya-teks">
          <p className="font-bold">Angka rekapitulasi ini tidak sah untuk dilaporkan.</p>
          <p className="mt-0.5 leading-relaxed">
            Data balita gagal dibaca dari server: {galatBaca} Seluruh angka dan persentase
            di bawah dihitung dari data yang tidak lengkap. Muat ulang halaman sebelum
            memakainya, dan jangan menandatangani laporan dari layar ini.
          </p>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-laut-100 px-3 py-1 text-xs font-bold text-laut-800">
            <FileSpreadsheet className="size-3.5 text-laut-600" />
            <span>Laporan Agregat Multi-Faskes</span>
          </div>
          <h1 className="font-display mt-2 text-2xl font-bold text-tinta-900 sm:text-3xl">
            Rekapitulasi Stunting & Gizi Balita
          </h1>
          <p className="text-xs text-tinta-600 sm:text-sm">
            Data prevalensi bulanan berstandar WHO dengan pembilang dan penyebut transparan
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <Button
            type="button"
            onClick={unduhExcel}
            sedangProses={sedangUnduh}
            varian="utama"
          >
            <Download className="size-4" />
            Unduh Excel (seluruh data)
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="grid gap-3 rounded-2xl bg-white p-4 shadow-[var(--shadow-kartu)] sm:grid-cols-3">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-tinta-400">
            Bulan Pemeriksaan
          </label>
          <input
            type="month"
            value={bulan}
            onChange={(e) => setBulan(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl bg-kabut-50 px-3 text-xs font-semibold text-tinta-900 ring-1 ring-kabut-200 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-tinta-400">
            Kabupaten / Kota
          </label>
          <select
            value={kabupaten}
            onChange={(e) => setKabupaten(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl bg-kabut-50 px-3 text-xs font-semibold text-tinta-900 ring-1 ring-kabut-200 focus:outline-none"
          >
            <option value="semua">Semua 6 Kabupaten/Kota</option>
            {pilihanKabupaten.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <div className="flex h-11 w-full items-center justify-between rounded-xl bg-laut-50 px-4 text-xs font-bold text-laut-800 ring-1 ring-laut-200">
            <span>Standar WHO 2006</span>
            <span className="angka text-karawo-700">0–60 Bulan</span>
          </div>
        </div>
      </div>

      {/* Aggregated Indicator Metric Cards (Wajib Pembilang & Penyebut) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Card 1: Total Balita */}
        <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow-kartu)]">
          <p className="text-xs font-bold uppercase tracking-wider text-tinta-400">
            {bulan ? 'Balita Ditimbang Bulan Ini' : 'Total Balita Terdata'}
          </p>
          <p className="angka mt-2 text-3xl font-extrabold text-tinta-900">{totalBalita}</p>
          <p className="mt-1 text-xs text-tinta-600">
            Total <span className="font-bold text-tinta-900">{totalSkrining}</span> kali pengukuran KMS
          </p>
        </div>

        {/* Card 2: Prevalensi Stunting */}
        <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow-kartu)]">
          <p className="text-xs font-bold uppercase tracking-wider text-waspada-teks">Prevalensi Stunting</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="angka text-3xl font-extrabold text-waspada-teks">{pStunting}%</span>
          </div>
          <p className="mt-1 text-xs font-bold text-tinta-700">
            {countStunting} dari {totalBalita} balita (TB/U &lt; -2 SD)
          </p>
        </div>

        {/* Card 3: Prevalensi Wasting */}
        <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow-kartu)]">
          <p className="text-xs font-bold uppercase tracking-wider text-bahaya-teks">Prevalensi Wasting</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="angka text-3xl font-extrabold text-bahaya-teks">{pWasting}%</span>
          </div>
          <p className="mt-1 text-xs font-bold text-tinta-700">
            {countWasting} dari {totalBalita} balita (BB/TB &lt; -2 SD)
          </p>
        </div>

        {/* Card 4: Red Flag Rujukan */}
        <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow-kartu)]">
          <p className="text-xs font-bold uppercase tracking-wider text-bahaya-teks">Kasus Perlu Rujukan</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="angka text-3xl font-extrabold text-bahaya-teks">{countRedFlag}</span>
            <span className="text-xs font-bold text-tinta-600">Anak</span>
          </div>
          <p className="mt-1 text-xs text-tinta-600">
            {pRedFlag}% dari balita ditimbang (penanda rujukan mesin)
          </p>
        </div>
      </div>

      {/* Tabel Ringkasan Posyandu */}
      <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow-kartu)] sm:p-6">
        <div className="flex items-center justify-between border-b border-kabut-200 pb-4">
          <div>
            <h2 className="font-display text-base font-bold text-tinta-900 sm:text-lg">
              Agregat Posyandu & Puskesmas
            </h2>
            <p className="text-xs text-tinta-600">
              Per posyandu, pengukuran terakhir tiap balita {bulan ? `pada bulan ${bulan}` : 'sepanjang waktu'}; persentase disertai pembilang dan penyebut
            </p>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-kabut-200 bg-kabut-100 text-tinta-600">
                <th className="rounded-l-xl p-3">Posyandu / Faskes</th>
                <th className="p-3">Kabupaten / Kota</th>
                <th className="p-3">Balita Terdata</th>
                <th className="p-3">Stunting (TB/U &lt; -2)</th>
                <th className="p-3">Prevalensi Stunting</th>
                <th className="p-3">Wasting (BB/TB &lt; -2)</th>
                <th className="rounded-r-xl p-3">Prevalensi Wasting</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-kabut-100">
              {totalBalita === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-xs text-tinta-500">
                    Belum ada data penimbangan balita yang tercatat pada periode ini.
                  </td>
                </tr>
              ) : (
                rekap.perPosyandu.map((r) => (
                  <tr key={r.kunci} className="hover:bg-kabut-50">
                    <td className="p-3 font-bold text-tinta-900">
                      {r.posyandu || '-'}
                      <span className="block text-[11px] font-normal text-tinta-500">{r.puskesmas}</span>
                    </td>
                    <td className="p-3 text-tinta-600">{r.kabupaten}</td>
                    <td className="angka p-3 font-bold">{r.balita} balita</td>
                    <td className="angka p-3 text-waspada-teks font-bold">{r.stunting} anak</td>
                    <td className="angka p-3 font-bold text-waspada-teks">{tampilPersen(persen(r.stunting, r.balita))}% ({r.stunting}/{r.balita})</td>
                    <td className="angka p-3 text-bahaya-teks font-bold">{r.wasting} anak</td>
                    <td className="angka p-3 font-bold text-bahaya-teks">{tampilPersen(persen(r.wasting, r.balita))}% ({r.wasting}/{r.balita})</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
