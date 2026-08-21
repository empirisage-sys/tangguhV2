'use client'

import { useState } from 'react'
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { SeriKurva, TitikRujukan } from '@/lib/grafik/seri'
import { formatTanggal, formatZ } from '@/lib/tampilan/format'
import { Baby, Info, Layers } from 'lucide-react'

/**
 * Kurva pertumbuhan WHO autentik untuk Laki-laki dan Perempuan (BB/TB, TB/U, BB/U).
 *
 * Mengikuti palet resmi WHO Child Growth Standards:
 * - Laki-laki: Tema Biru Standar WHO (#0284C7)
 * - Perempuan: Tema Merah Muda/Pink Standar WHO (#E11D48)
 * - Garis Median (0 SD): Hijau (#15803D)
 * - Garis ±2 SD: Kuning / Amber (#F59E0B)
 * - Garis ±3 SD: Merah (#DC2626)
 */

type Props = {
  seri: SeriKurva
  tinggi?: number
  tampilkanKMSBands?: boolean
}

function interpolasiRujukan(
  x: number,
  rPrev: TitikRujukan,
  rNext: TitikRujukan,
) {
  const dx = rNext.x - rPrev.x
  const rasio = dx === 0 ? 0 : (x - rPrev.x) / dx
  const lerp = (v1: number, v2: number) =>
    Math.round((v1 + (v2 - v1) * rasio) * 100) / 100

  return {
    sd_n3: lerp(rPrev.sd_n3, rNext.sd_n3),
    sd_n2: lerp(rPrev.sd_n2, rNext.sd_n2),
    sd_n1: lerp(rPrev.sd_n1, rNext.sd_n1),
    sd_0: lerp(rPrev.sd_0, rNext.sd_0),
    sd_p1: lerp(rPrev.sd_p1, rNext.sd_p1),
    sd_p2: lerp(rPrev.sd_p2, rNext.sd_p2),
    sd_p3: lerp(rPrev.sd_p3, rNext.sd_p3),
  }
}

export function KurvaWHO({ seri, tinggi = 360, tampilkanKMSBands = true }: Props) {
  const [showBands, setShowBands] = useState<boolean>(tampilkanKMSBands)
  const isLaki = seri.seks === 'lk'

  const warnaAnak = isLaki ? '#0284C7' : '#E11D48'
  const warnaTitik = isLaki ? '#0369A1' : '#BE123C'

  // Siapkan data kurva dengan referensi rujukan
  const data = seri.rujukan.map((r) => {
    const titikAnak = seri.anak.find((a) => Math.abs(a.x - r.x) < 1e-4)
    return {
      ...r,
      anak: titikAnak?.tidakDinilai ? null : titikAnak?.y ?? null,
      tanggal: titikAnak?.tanggal ?? null,
      z: titikAnak?.z ?? null,
    }
  })

  // Sisipkan titik anak yang x-nya tidak persis sama dengan grid rujukan,
  // dengan menginterpolasi nilai rujukan WHO agar garis kurva TIDAK TERPUTUS.
  for (const a of seri.anak) {
    if (!data.some((d) => Math.abs(d.x - a.x) < 1e-4)) {
      // Cari rPrev dan rNext dari seri.rujukan
      let rPrev: TitikRujukan | undefined
      let rNext: TitikRujukan | undefined

      for (const r of seri.rujukan) {
        if (r.x <= a.x) rPrev = r
        if (r.x >= a.x && !rNext) rNext = r
      }

      let rujukanNilai: ReturnType<typeof interpolasiRujukan>
      if (rPrev && rNext && rPrev !== rNext) {
        rujukanNilai = interpolasiRujukan(a.x, rPrev, rNext)
      } else if (rPrev) {
        rujukanNilai = {
          sd_n3: rPrev.sd_n3,
          sd_n2: rPrev.sd_n2,
          sd_n1: rPrev.sd_n1,
          sd_0: rPrev.sd_0,
          sd_p1: rPrev.sd_p1,
          sd_p2: rPrev.sd_p2,
          sd_p3: rPrev.sd_p3,
        }
      } else if (rNext) {
        rujukanNilai = {
          sd_n3: rNext.sd_n3,
          sd_n2: rNext.sd_n2,
          sd_n1: rNext.sd_n1,
          sd_0: rNext.sd_0,
          sd_p1: rNext.sd_p1,
          sd_p2: rNext.sd_p2,
          sd_p3: rNext.sd_p3,
        }
      } else {
        rujukanNilai = {
          sd_n3: 0,
          sd_n2: 0,
          sd_n1: 0,
          sd_0: 0,
          sd_p1: 0,
          sd_p2: 0,
          sd_p3: 0,
        }
      }

      data.push({
        x: a.x,
        ...rujukanNilai,
        anak: a.tidakDinilai ? null : a.y,
        tanggal: a.tanggal,
        z: a.z,
      })
    }
  }

  data.sort((a, b) => a.x - b.x)

  const satuan = seri.labelY.includes('kg') ? 'kg' : 'cm'
  const satuanX = seri.indikator === 'bbtb' ? 'cm' : 'bulan'

  return (
    <figure className="space-y-3">
      {/* Header Kurva WHO */}
      <div
        className={[
          'flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4 text-white shadow-sm transition-all',
          isLaki
            ? 'bg-gradient-to-r from-sky-700 via-sky-600 to-cyan-600'
            : 'bg-gradient-to-r from-rose-700 via-rose-600 to-pink-600',
        ].join(' ')}
      >
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md">
            <Baby className="size-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <figcaption className="text-base font-bold sm:text-lg">
                {seri.judul}
              </figcaption>
            </div>
            <p className="text-xs text-white/85">
              Standar Pertumbuhan Anak WHO 2006 • {isLaki ? 'Laki-laki' : 'Perempuan'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowBands(!showBands)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md transition-colors hover:bg-white/25"
          >
            <Layers className="size-3.5" />
            {showBands ? 'Zona KMS: Aktif' : 'Zona KMS: Mati'}
          </button>
        </div>
      </div>

      {/* Area Grafik Recharts */}
      <div
        style={{ height: tinggi }}
        className="relative rounded-2xl border border-kabut-200 bg-white p-3 shadow-inner"
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 12, right: 36, bottom: 24, left: 6 }}>
            <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" strokeOpacity={0.7} />

            <XAxis
              dataKey="x"
              type="number"
              domain={seri.domainX}
              tickCount={8}
              tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
              label={{
                value: seri.labelX,
                position: 'insideBottom',
                offset: -16,
                style: { fontSize: 11, fill: '#334155', fontWeight: 700 },
              }}
            />
            <YAxis
              domain={seri.domainY}
              tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
              width={42}
              label={{
                value: seri.labelY,
                angle: -90,
                position: 'insideLeft',
                style: { fontSize: 11, fill: '#334155', fontWeight: 700 },
              }}
            />

            {/* Garis-Garis Standar WHO Child Growth Standards */}
            <Line
              dataKey="sd_p3"
              stroke="#DC2626"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              connectNulls
              name="+3 SD"
            />
            <Line
              dataKey="sd_p2"
              stroke="#F59E0B"
              strokeWidth={1.4}
              strokeDasharray="3 3"
              dot={false}
              connectNulls
              name="+2 SD"
            />
            <Line
              dataKey="sd_p1"
              stroke="#CBD5E1"
              strokeWidth={1}
              strokeDasharray="2 2"
              dot={false}
              connectNulls
              name="+1 SD"
            />
            <Line
              dataKey="sd_0"
              stroke="#15803D"
              strokeWidth={2.4}
              dot={false}
              connectNulls
              name="Median (0 SD)"
            />
            <Line
              dataKey="sd_n1"
              stroke="#CBD5E1"
              strokeWidth={1}
              strokeDasharray="2 2"
              dot={false}
              connectNulls
              name="-1 SD"
            />
            <Line
              dataKey="sd_n2"
              stroke="#F59E0B"
              strokeWidth={1.4}
              strokeDasharray="3 3"
              dot={false}
              connectNulls
              name="-2 SD"
            />
            <Line
              dataKey="sd_n3"
              stroke="#DC2626"
              strokeWidth={1.8}
              strokeDasharray="5 3"
              dot={false}
              connectNulls
              name="-3 SD"
            />

            {/* Titik & Garis Riwayat Pertumbuhan Anak */}
            <Line
              dataKey="anak"
              stroke={warnaAnak}
              strokeWidth={3}
              connectNulls
              dot={{ r: 5, fill: warnaTitik, stroke: '#FFFFFF', strokeWidth: 2.5 }}
              activeDot={{ r: 8, fill: warnaTitik, stroke: '#FFFFFF', strokeWidth: 3 }}
              name="Pengukuran Anak"
            />

            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0]?.payload as (typeof data)[number] | undefined
                if (!d) return null

                return (
                  <div className="rounded-xl bg-tinta-900/95 p-3.5 text-xs text-white shadow-2xl backdrop-blur-md ring-1 ring-white/20">
                    <p className="font-bold text-karawo-400">
                      {d.tanggal
                        ? `${formatTanggal(d.tanggal)} (${d.x} ${satuanX})`
                        : `${seri.labelX}: ${d.x} ${satuanX}`}
                    </p>

                    <div className="mt-2 space-y-1.5 min-w-[170px]">
                      {/* Nilai Median WHO (Selalu Ditampilkan Saat Kursor Menyorot) */}
                      <div className="flex items-center justify-between gap-4 rounded-lg bg-emerald-950/70 px-2.5 py-1.5 ring-1 ring-emerald-500/50">
                        <span className="font-bold text-emerald-300">Median (0 SD):</span>
                        <span className="angka font-black text-emerald-200 text-sm">
                          {d.sd_0 !== undefined && !Number.isNaN(d.sd_0) ? `${d.sd_0} ${satuan}` : '-'}
                        </span>
                      </div>

                      {/* Hasil Ukur Titik Anak bila ada */}
                      {d.anak !== null && d.anak !== undefined && (
                        <div className="border-t border-white/15 pt-1.5 space-y-1">
                          <div className="flex justify-between gap-4">
                            <span className="text-white/80 font-medium">Hasil Ukur:</span>
                            <span className="angka font-bold text-white">
                              {d.anak} {satuan}
                            </span>
                          </div>
                          {d.z !== null && d.z !== undefined && (
                            <div className="flex justify-between gap-4">
                              <span className="text-white/80 font-medium">Nilai Z-Score:</span>
                              <span className="angka font-bold text-cyan-300">
                                {formatZ(d.z)} SD
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Batas Baku WHO ±2 SD & ±3 SD */}
                      <div className="border-t border-white/15 pt-1 text-[11px] text-white/70 space-y-0.5">
                        <div className="flex justify-between gap-3">
                          <span>±2 SD:</span>
                          <span className="angka">{d.sd_n2} – {d.sd_p2} {satuan}</span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span>±3 SD:</span>
                          <span className="angka">{d.sd_n3} – {d.sd_p3} {satuan}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legenda Standar Garis WHO Sesuai Permintaan Pengguna */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-kabut-50 p-3 text-xs text-tinta-700 ring-1 ring-kabut-200">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-4 rounded-full bg-[#15803D]" />
            <span className="font-bold text-[#15803D]">Median (0 SD)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-4 rounded-full bg-[#F59E0B]" />
            <span className="font-bold text-amber-700">±2 SD</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-4 rounded-full bg-[#DC2626]" />
            <span className="font-bold text-red-700">±3 SD</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="size-3 rounded-full border-2 border-white shadow-sm"
              style={{ backgroundColor: warnaTitik }}
            />
            <span className="font-bold" style={{ color: warnaTitik }}>
              Hasil Ukur Anak
            </span>
          </div>
        </div>

        <span className="text-[11px] font-semibold text-tinta-400">
          Standar WHO 2006
        </span>
      </div>

      {seri.catatan.length > 0 && (
        <ul className="space-y-1 rounded-xl bg-kabut-50 p-3 text-xs leading-relaxed text-tinta-600 ring-1 ring-kabut-200">
          {seri.catatan.map((c, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <Info className="size-3.5 shrink-0 text-laut-600 mt-0.5" />
              <span>{c}</span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  )
}
