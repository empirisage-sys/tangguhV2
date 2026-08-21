'use client'

import { useState, useMemo } from 'react'
import { PRODUK_PKMK_LIST, type ProdukPKMK } from '@/lib/db/pkmk'
import { Sparkles, Utensils, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export type FormulasiPKMKProps = {
  namaBalita?: string
  umurBulan?: number
  beratKg?: number
  targetEnergiDefaultKkal?: number
  onSimpan?: (data: {
    tataLaksana: string
    targetKaloriPersen: number
    targetKaloriKkal: number
    produk: ProdukPKMK
    frekuensiPerHari: number
    sendokPerSaji: number
    mlAirPerSaji: number
  }) => void
}

export function FormulasiPKMKSection({
  namaBalita = 'Balita',
  umurBulan = 24,
  beratKg = 8.0,
  targetEnergiDefaultKkal = 770,
  onSimpan,
}: FormulasiPKMKProps) {
  // 1. Tata Laksana Klinis
  const [tataLaksana, setTataLaksana] = useState<string>('PKMK + observasi 2 minggu')

  // 2. Target Kalori PKMK (0%, 30%, 40%, 50%, 60%, 70%, 80%, 90%, 100%)
  const [targetPersen, setTargetPersen] = useState<number>(80)

  // 3. Produk PKMK
  const [produkId, setProdukId] = useState<string>(PRODUK_PKMK_LIST[0]?.id || 'pkmk-1')

  // 4. Frekuensi / Hari (1x, 2x, 3x, 4x, 5x)
  const [frekuensi, setFrekuensi] = useState<number>(3)

  // 5. Sendok Takar / Saji (1 sendok, 2 sendok, 3 sendok, 4 sendok, 5 sendok)
  const [sendokTakar, setSendokTakar] = useState<number>(3)

  const produkDipilih = useMemo(() => {
    return PRODUK_PKMK_LIST.find((p) => p.id === produkId) || PRODUK_PKMK_LIST[0]!
  }, [produkId])

  // Perhitungan Kalori
  const targetKaloriKkal = Math.round((targetEnergiDefaultKkal * targetPersen) / 100)
  const sisaKaloriMakananASI = Math.max(0, targetEnergiDefaultKkal - targetKaloriKkal)

  // Takaran per saji
  const mlAirPerSaji = Math.round(sendokTakar * (produkDipilih.mlAirPerSendok || 30))
  const totalSendokHarian = sendokTakar * frekuensi
  const kaloriPKMKHarian = Math.round(totalSendokHarian * produkDipilih.kkalPerSendok)

  const handleSimpan = () => {
    if (onSimpan) {
      onSimpan({
        tataLaksana,
        targetKaloriPersen: targetPersen,
        targetKaloriKkal,
        produk: produkDipilih,
        frekuensiPerHari: frekuensi,
        sendokPerSaji: sendokTakar,
        mlAirPerSaji,
      })
    } else {
      alert(
        `Formulasi intervensi gizi untuk ${namaBalita} berhasil disimpan!\n\n` +
          `• Tata Laksana: ${tataLaksana}\n` +
          `• Target Kalori PKMK: ${targetPersen}% (${targetKaloriKkal} kkal)\n` +
          `• Produk: ${produkDipilih.nama}\n` +
          `• Takaran: ${frekuensi}x sehari, per saji ${sendokTakar} sendok takar dlm ${mlAirPerSaji} ml air hangat.`,
      )
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-kabut-200 bg-white p-5 shadow-[var(--shadow-kartu)] sm:p-6">
      {/* Title seperti di Gambar 2 */}
      <div>
        <h2 className="font-display text-lg font-bold text-laut-800 sm:text-xl">
          Tata Laksana &amp; Rekomendasi Intervensi Gizi
        </h2>
        <p className="text-xs text-tinta-600">
          Untuk balita: <span className="font-bold text-tinta-900">{namaBalita}</span>
        </p>
      </div>

      {/* Field: Tata Laksana (Klinis) */}
      <div className="rounded-xl border border-kabut-200 bg-kabut-50/70 p-3.5">
        <label
          htmlFor="tataLaksanaSelect"
          className="block text-xs font-semibold text-laut-800"
        >
          Tata Laksana (Klinis)
        </label>
        <select
          id="tataLaksanaSelect"
          value={tataLaksana}
          onChange={(e) => setTataLaksana(e.target.value)}
          className="mt-1 h-11 w-full rounded-xl border border-kabut-200 bg-white px-3 text-sm font-semibold text-tinta-900 focus:border-laut-500 focus:outline-none"
        >
          <option value="">-- Pilih Tata Laksana --</option>
          <option value="PKMK + observasi 2 minggu">PKMK + observasi 2 minggu</option>
          <option value="PKMK + Observasi 4 minggu">PKMK + Observasi 4 minggu</option>
          <option value="Rujuk Spesialis Anak">Rujuk Spesialis Anak</option>
        </select>
      </div>

      {/* 4 Kolom Dropdown Sejajar Seperti Gambar 2 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Kolom 1: Target Kalori PKMK (0%, 30%, 40%, 50%, 60%, 70%, 80%, 90%, 100%) */}
        <div>
          <label
            htmlFor="targetPersenSelect"
            className="block text-xs font-semibold text-tinta-700"
          >
            Target Kalori PKMK
          </label>
          <select
            id="targetPersenSelect"
            value={targetPersen}
            onChange={(e) => setTargetPersen(Number(e.target.value))}
            className="mt-1 h-11 w-full rounded-xl border border-kabut-200 bg-white px-3 text-sm font-bold text-tinta-900 focus:border-laut-500 focus:outline-none"
          >
            {[0, 30, 40, 50, 60, 70, 80, 90, 100].map((pct) => (
              <option key={pct} value={pct}>
                {pct}%
              </option>
            ))}
          </select>
        </div>

        {/* Kolom 2: Produk PKMK */}
        <div>
          <label
            htmlFor="produkSelect"
            className="block text-xs font-semibold text-tinta-700"
          >
            Produk PKMK
          </label>
          <select
            id="produkSelect"
            value={produkId}
            onChange={(e) => setProdukId(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-kabut-200 bg-white px-3 text-sm font-semibold text-tinta-900 focus:border-laut-500 focus:outline-none"
          >
            {PRODUK_PKMK_LIST.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nama}
              </option>
            ))}
          </select>
        </div>

        {/* Kolom 3: Frekuensi / Hari (1x, 2x, 3x, 4x, 5x) */}
        <div>
          <label
            htmlFor="frekuensiSelect"
            className="block text-xs font-semibold text-tinta-700"
          >
            Frekuensi/Hari
          </label>
          <select
            id="frekuensiSelect"
            value={frekuensi}
            onChange={(e) => setFrekuensi(Number(e.target.value))}
            className="mt-1 h-11 w-full rounded-xl border border-kabut-200 bg-white px-3 text-sm font-bold text-tinta-900 focus:border-laut-500 focus:outline-none"
          >
            {[1, 2, 3, 4, 5].map((f) => (
              <option key={f} value={f}>
                {f}x
              </option>
            ))}
          </select>
        </div>

        {/* Kolom 4: Sendok Takar / Saji (1 sendok, 2 sendok, 3 sendok, 4 sendok, 5 sendok) */}
        <div>
          <label
            htmlFor="sendokSelect"
            className="block text-xs font-semibold text-tinta-700"
          >
            Sendok Takar/Saji
          </label>
          <select
            id="sendokSelect"
            value={sendokTakar}
            onChange={(e) => setSendokTakar(Number(e.target.value))}
            className="mt-1 h-11 w-full rounded-xl border border-kabut-200 bg-white px-3 text-sm font-bold text-tinta-900 focus:border-laut-500 focus:outline-none"
          >
            {[1, 2, 3, 4, 5].map((s) => (
              <option key={s} value={s}>
                {s} sendok
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Bagian Perhitungan Target Energi & Kotak Hijau Takaran Saji Harian (Seperti Gambar 2) */}
      <div className="grid gap-3 pt-2 md:grid-cols-12">
        {/* Kolom Kiri: Breakdown Kalori */}
        <div className="space-y-2 md:col-span-7">
          <div className="rounded-xl border border-kabut-200 bg-white p-3 text-xs">
            <p className="text-[11px] font-bold uppercase tracking-wider text-tinta-400">
              Target Kebutuhan Energi Anak (Catch-up Growth : {targetEnergiDefaultKkal} kkal)
            </p>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-tinta-600">Target Kalori PKMK ({targetPersen}%):</span>
              <span className="angka text-sm font-bold text-laut-800">
                {targetKaloriKkal} kkal
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-kabut-200 bg-white p-3 text-xs">
            <div className="flex items-baseline justify-between">
              <span className="text-tinta-600">Sisa Kalori dari Makanan Keluarga / ASI:</span>
              <span className="angka text-sm font-bold text-tinta-900">
                {sisaKaloriMakananASI} kkal
              </span>
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Kotak Hijau Takaran Saji Harian (Seperti Gambar 2) */}
        <div className="flex flex-col justify-center rounded-xl bg-[#E8F8F0] p-4 text-right md:col-span-5">
          <p className="text-base font-extrabold text-[#1B804B]">Takaran Saji Harian</p>
          <p className="mt-0.5 text-xs font-bold text-[#1B804B]">{frekuensi}x sehari.</p>
          <p className="mt-1 text-sm font-black text-[#156E3F]">
            Per saji: {sendokTakar} takar dlm {mlAirPerSaji} ml air
          </p>
          <p className="mt-0.5 text-[11px] text-[#2C955E]">
            (Total {totalSendokHarian} sendok takar / hari)
          </p>
        </div>
      </div>

      {/* Tombol Simpan Asuhan Gizi */}
      <div className="pt-2">
        <Button type="button" onClick={handleSimpan} varian="utama" lebarPenuh>
          Simpan Asuhan Gizi Balita
        </Button>
      </div>
    </div>
  )
}
