'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Baby,
  Calculator,
  ChevronRight,
  HeartPulse,
  Info,
  Pill,
  Sparkles,
  Utensils,
  X,
} from 'lucide-react'
import { PRODUK_PKMK_LIST, type ProdukPKMK } from '@/lib/db/pkmk'
import { SAMPLE_BALITA_DATABASE, type BalitaDetail } from '@/lib/db/balita-mock'
import { LencanaStatus } from '@/components/ui/LencanaStatus'
import { tampilanBBTB, tampilanTBU } from '@/lib/tampilan/status'
import { FormulasiPKMKSection } from '@/components/dietisien/FormulasiPKMKSection'
import { apakahPerluPKMK } from '@/lib/zscore'

export default function HalamanDietisien() {
  const [balitaTerpilih, setBalitaTerpilih] = useState<BalitaDetail | null>(null)
  const [panelTerbuka, setPanelTerbuka] = useState<boolean>(false)

  // Prioritas klinis: Hanya balita dengan indikasi tata laksana PKMK
  const daftarPrioritas = SAMPLE_BALITA_DATABASE.filter((b) => {
    const s = b.riwayat[b.riwayat.length - 1]
    if (!s) return false
    return apakahPerluPKMK({
      statusBBTB: s.statusBBTB,
      statusTBU: s.statusTBU,
      statusBBU: s.statusBBU,
      edema: s.edema,
    })
  }).sort((a, b) => {
    const sA = a.riwayat[a.riwayat.length - 1]
    const sB = b.riwayat[b.riwayat.length - 1]
    const skorA = sA?.statusBBTB === 'gizi_buruk' ? 2 : 1
    const skorB = sB?.statusBBTB === 'gizi_buruk' ? 2 : 1
    return skorB - skorA
  })

  const bukaFormulasi = (balita: BalitaDetail) => {
    setBalitaTerpilih(balita)
    setPanelTerbuka(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-karawo-100 px-3 py-1 text-xs font-bold text-karawo-700">
            <Utensils className="size-3.5 text-karawo-500" />
            <span>Asuhan Gizi &amp; Formulasi Medis Terapi</span>
          </div>
          <h1 className="font-display mt-2 text-2xl font-bold text-tinta-900 sm:text-3xl">
            Dasbor Dietisien &amp; Nutrisi Klinis
          </h1>
          <p className="text-xs text-tinta-600 sm:text-sm">
            Prioritas balita wasted dan stunting serta kalkulator presisi takaran sendok produk PKMK
          </p>
        </div>
      </div>

      {/* Peringatan Klinis Inpatient Protocol */}
      <div className="rounded-2xl bg-waspada-bg p-5 ring-1 ring-waspada-garis">
        <div className="flex items-start gap-3">
          <AlertTriangle className="size-5 shrink-0 text-waspada-teks" />
          <div className="text-xs leading-relaxed text-waspada-teks sm:text-sm">
            <p className="font-bold">Protokol Penanganan Gizi Buruk dengan Komplikasi</p>
            <p className="mt-1">
              Balita berstatus Gizi Buruk yang disertai komplikasi medis (edema berat +++, anoreksia berat, demam tinggi, hipoglikemia, atau hipotermia) memerlukan penanganan rawat inap di Rumah Sakit sesuai Tata Laksana Gizi Buruk (TGC). Formulasi rawat jalan PKMK hanya untuk gizi buruk tanpa komplikasi klinis.
            </p>
          </div>
        </div>
      </div>

      {/* Bagian Tersendiri: Tata Laksana & Rekomendasi Intervensi Gizi Aktif */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-tinta-900 sm:text-lg">
            Kalkulator Formulasi Resep PKMK
          </h2>
          <span className="text-xs font-semibold text-tinta-600">
            Pilih balita dari daftar prioritas atau gunakan kalkulator langsung
          </span>
        </div>
        <FormulasiPKMKSection
          namaBalita={balitaTerpilih ? balitaTerpilih.nama : 'Pasien Anak (Simulasi)'}
          umurBulan={balitaTerpilih ? balitaTerpilih.riwayat[balitaTerpilih.riwayat.length - 1]?.umurBulan ?? 12 : 12}
          beratKg={balitaTerpilih ? balitaTerpilih.riwayat[balitaTerpilih.riwayat.length - 1]?.beratKg ?? 7.5 : 7.5}
          targetEnergiDefaultKkal={750}
        />
      </div>

      {/* Daftar Prioritas Balita Intervensi */}
      <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow-kartu)] sm:p-6">
        <div className="flex items-center justify-between border-b border-kabut-200 pb-4">
          <div>
            <h2 className="font-display text-base font-bold text-tinta-900 sm:text-lg">
              Daftar Prioritas Asuhan Gizi Puskesmas
            </h2>
            <p className="text-xs text-tinta-600">
              Disaring otomatis berdasarkan kode kategori medis (Gizi Buruk, Gizi Kurang, Stunting)
            </p>
          </div>
          <span className="angka rounded-full bg-bahaya-bg px-3 py-1 text-xs font-bold text-bahaya-teks ring-1 ring-bahaya-garis">
            {daftarPrioritas.length} Balita Prioritas
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {daftarPrioritas.map((balita) => {
            const skrining = balita.riwayat[balita.riwayat.length - 1]
            if (!skrining) return null
            const statusTB = tampilanTBU(skrining.statusTBU)
            const statusBB = tampilanBBTB(skrining.statusBBTB)

            return (
              <div
                key={balita.id}
                className="flex flex-col justify-between gap-4 rounded-xl border border-kabut-200 bg-kabut-50/60 p-4 transition-colors hover:bg-white sm:flex-row sm:items-center"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/balita/${balita.id}`}
                      className="font-bold text-tinta-900 hover:text-laut-700 hover:underline"
                    >
                      {balita.nama}
                    </Link>
                    <span className="angka text-xs text-tinta-600">
                      ({skrining.umurBulan} bulan, {balita.jenisKelamin === 'L' ? 'L' : 'P'})
                    </span>
                  </div>
                  <p className="angka text-xs text-tinta-600">
                    BB: {skrining.beratKg} kg • TB: {skrining.panjangCm} cm • {balita.namaPosyandu}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <LencanaStatus status={statusBB} ukuran="kecil" />
                  <LencanaStatus status={statusTB} ukuran="kecil" />

                  <button
                    type="button"
                    onClick={() => bukaFormulasi(balita)}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-karawo-400 px-3 text-xs font-bold text-karawo-700 shadow-sm transition-colors hover:bg-karawo-500 hover:text-white"
                  >
                    <Calculator className="size-3.5" />
                    Formulasi PKMK
                  </button>

                  <Link
                    href={`/balita/${balita.id}`}
                    className="flex size-10 items-center justify-center rounded-xl bg-white text-tinta-600 ring-1 ring-kabut-200 hover:bg-kabut-100"
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

      {/* BOTTOM PANEL / BOTTOM SHEET MODAL (Seperti Gambar 1) */}
      {panelTerbuka && balitaTerpilih && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:p-4">
          <div className="w-full max-w-4xl rounded-t-3xl bg-white p-6 shadow-2xl transition-all sm:rounded-3xl sm:p-8 max-h-[90vh] overflow-y-auto">
            {/* Header Modal Persis Seperti Gambar 1 */}
            <div className="flex items-center justify-between border-b border-kabut-200 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-lg font-bold text-tinta-900 sm:text-xl">
                    Kalkulator Formulasi Resep PKMK
                  </h2>
                  <span className="rounded-full bg-karawo-100 px-2.5 py-0.5 text-xs font-bold text-karawo-700">
                    Panel Bawah
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-tinta-600">
                  Untuk balita: <span className="font-bold text-tinta-900">{balitaTerpilih.nama}</span>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setPanelTerbuka(false)}
                className="flex size-9 items-center justify-center rounded-full bg-kabut-100 text-tinta-600 hover:bg-kabut-200"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Isi Formulasi Persis Seperti Gambar 2 */}
            <div className="mt-5">
              <FormulasiPKMKSection
                namaBalita={balitaTerpilih.nama}
                umurBulan={balitaTerpilih.riwayat[balitaTerpilih.riwayat.length - 1]?.umurBulan ?? 24}
                beratKg={balitaTerpilih.riwayat[balitaTerpilih.riwayat.length - 1]?.beratKg ?? 8.0}
                targetEnergiDefaultKkal={770}
                onSimpan={() => {
                  alert(
                    `Formulasi PKMK untuk ${balitaTerpilih.nama} berhasil disimpan ke rekam asuhan gizi.`,
                  )
                  setPanelTerbuka(false)
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
