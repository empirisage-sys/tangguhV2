'use client'

import { useState } from 'react'
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
import { KABUPATEN_GORONTALO, getPuskesmasByKabupaten, getPosyanduByPuskesmas } from '@/lib/db/wilayah'
import { SAMPLE_BALITA_DATABASE } from '@/lib/db/balita-mock'
import { Button } from '@/components/ui/Button'

export default function HalamanRekapitulasi() {
  const [kabupatenId, setKabupatenId] = useState<string>('kab-7571')
  const [bulan, setBulan] = useState<string>('2026-08')
  const [sedangUnduh, setSedangUnduh] = useState<boolean>(false)

  const totalBalita = SAMPLE_BALITA_DATABASE.length
  const totalSkrining = SAMPLE_BALITA_DATABASE.reduce((acc, b) => acc + b.riwayat.length, 0)

  // Hitung jumlah stunting & wasting dengan pembilang/penyebut
  let countStunting = 0
  let countWasting = 0
  let countRedFlag = 0

  for (const b of SAMPLE_BALITA_DATABASE) {
    const s = b.riwayat[b.riwayat.length - 1]
    if (s) {
      if (s.statusTBU === 'pendek' || s.statusTBU === 'sangat_pendek') countStunting++
      if (s.statusBBTB === 'gizi_kurang' || s.statusBBTB === 'gizi_buruk') countWasting++
      if (s.statusBBTB === 'gizi_buruk' || s.statusTBU === 'sangat_pendek') countRedFlag++
    }
  }

  const pStunting = totalBalita > 0 ? ((countStunting / totalBalita) * 100).toFixed(1) : '0.0'
  const pWasting = totalBalita > 0 ? ((countWasting / totalBalita) * 100).toFixed(1) : '0.0'
  const pRedFlag = totalBalita > 0 ? ((countRedFlag / totalBalita) * 100).toFixed(1) : '0.0'

  const unduhExcel = async () => {
    setSedangUnduh(true)
    try {
      const response = await fetch('/api/ekspor/excel')
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Rekap_TANGGUH_Gorontalo_${bulan}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
    } finally {
      setSedangUnduh(false)
    }
  }

  return (
    <div className="space-y-6">
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
            Unduh Excel (.xlsx)
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
            value={kabupatenId}
            onChange={(e) => setKabupatenId(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl bg-kabut-50 px-3 text-xs font-semibold text-tinta-900 ring-1 ring-kabut-200 focus:outline-none"
          >
            <option value="semua">Semua 6 Kabupaten/Kota</option>
            {KABUPATEN_GORONTALO.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nama}
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
          <p className="text-xs font-bold uppercase tracking-wider text-tinta-400">Total Balita Terdata</p>
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
            {pRedFlag}% dari total sasaran (Z &lt; -3 SD)
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
              Setiap persentase disajikan bersama pembilang dan penyebut sesuai view <code>v_rekap_bulanan</code>
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
                <tr className="hover:bg-kabut-50">
                  <td className="p-3 font-bold text-tinta-900">Rekapitulasi Wilayah</td>
                  <td className="p-3 text-tinta-600">Gorontalo</td>
                  <td className="angka p-3 font-bold">{totalBalita} balita</td>
                  <td className="angka p-3 text-waspada-teks font-bold">{countStunting} anak</td>
                  <td className="angka p-3 font-bold text-waspada-teks">{pStunting}% ({countStunting}/{totalBalita})</td>
                  <td className="angka p-3 text-bahaya-teks font-bold">{countWasting} anak</td>
                  <td className="angka p-3 font-bold text-bahaya-teks">{pWasting}% ({countWasting}/{totalBalita})</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
