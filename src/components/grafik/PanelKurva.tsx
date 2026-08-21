'use client'

import { useMemo, useState } from 'react'
import type { KunjunganRiwayat, SeriKurva, SeriTrenZ } from '@/lib/grafik/seri'
import {
  seriBBU,
  seriTBU,
  seriBBTB,
  seriTrenZ,
  type JenisKelamin,
  type IndikatorPanjang,
} from '@/lib/grafik/seri'
import { LABEL_TAB, tabKurvaUntuk, type Peran, type TabKurva } from '@/lib/tampilan/akses'
import { KurvaWHO } from './KurvaWHO'
import { TrenZScore } from './TrenZScore'
import { Baby, Calendar, Check, SlidersHorizontal, Sparkles } from 'lucide-react'

/**
 * Panel Kurva Pertumbuhan WHO yang otomatis menyesuaikan jenis kelamin anak
 * (Laki-laki atau Perempuan) serta pilihan rentang skala umur.
 */

type Props = {
  bbu?: SeriKurva
  tbu?: SeriKurva
  bbtb?: SeriKurva
  trenZ?: SeriTrenZ
  riwayat?: KunjunganRiwayat[]
  jenisKelaminAwal?: JenisKelamin
  peran: Peran
}

export function PanelKurva({
  bbu: initialBbu,
  tbu: initialTbu,
  bbtb: initialBbtb,
  trenZ: initialTrenZ,
  riwayat = [],
  jenisKelaminAwal = 'lk',
  peran,
}: Props) {
  const tab = tabKurvaUntuk(peran)
  const [aktif, setAktif] = useState<TabKurva>('bbu')
  
  // Jenis kelamin otomatis terkunci sesuai data balita
  const seks: JenisKelamin = initialBbu?.seks ?? jenisKelaminAwal

  const [modeRentang, setModeRentang] = useState<'otomatis' | '0-24' | '0-60'>(
    'otomatis',
  )
  const [basisBBTB, setBasisBBTB] = useState<IndikatorPanjang | 'otomatis'>('otomatis')

  // Hitung rentang kustom jika dipilih
  const rentangUmur = useMemo<[number, number] | undefined>(() => {
    if (modeRentang === '0-24') return [0, 24]
    if (modeRentang === '0-60') return [0, 60]
    return undefined
  }, [modeRentang])

  const rentangPanjang = useMemo<[number, number] | undefined>(() => {
    if (modeRentang === '0-24') return [45, 110]
    if (modeRentang === '0-60') return [65, 120]
    return undefined
  }, [modeRentang])

  // Bangun ulang seri jika opsi rentang/basis berubah
  const kurvaBBU = useMemo(() => {
    if (riwayat.length > 0) {
      return seriBBU(riwayat, seks, rentangUmur)
    }
    return initialBbu
  }, [riwayat, seks, rentangUmur, initialBbu])

  const kurvaTBU = useMemo(() => {
    if (riwayat.length > 0) {
      return seriTBU(riwayat, seks, rentangUmur)
    }
    return initialTbu
  }, [riwayat, seks, rentangUmur, initialTbu])

  const kurvaBBTB = useMemo(() => {
    if (riwayat.length > 0) {
      const basis = basisBBTB === 'otomatis' ? undefined : basisBBTB
      return seriBBTB(riwayat, seks, basis, rentangPanjang)
    }
    return initialBbtb
  }, [riwayat, seks, basisBBTB, rentangPanjang, initialBbtb])

  const kurvaTrenZ = useMemo(() => {
    if (riwayat.length > 0) {
      return seriTrenZ(riwayat)
    }
    return initialTrenZ
  }, [riwayat, initialTrenZ])

  return (
    <div className="space-y-4">
      {/* Controls Toolbar: Tab Pilihan Kurva & Label Jenis Kelamin Balita */}
      <div className="flex flex-col justify-between gap-3 rounded-2xl bg-kabut-50 p-3 ring-1 ring-kabut-200 sm:flex-row sm:items-center">
        {/* Tab Pilihan Kurva */}
        <div
          role="tablist"
          aria-label="Pilih kurva pertumbuhan"
          className="flex gap-1.5 overflow-x-auto"
        >
          {tab.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={aktif === t}
              onClick={() => setAktif(t)}
              className={[
                'min-h-11 shrink-0 rounded-xl px-3.5 text-xs font-bold transition-all',
                aktif === t
                  ? 'bg-laut-600 text-white shadow-md shadow-laut-600/20'
                  : 'bg-white text-tinta-700 ring-1 ring-kabut-200 hover:bg-kabut-100',
              ].join(' ')}
            >
              {LABEL_TAB[t]}
            </button>
          ))}
        </div>

        {/* Lencana Otomatis Jenis Kelamin Balita (Tanpa Switcher Ganda) */}
        <div className="flex items-center self-start sm:self-auto">
          <span
            className={[
              'inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold shadow-sm',
              seks === 'lk'
                ? 'bg-sky-100 text-sky-800 ring-1 ring-sky-300'
                : 'bg-rose-100 text-rose-800 ring-1 ring-rose-300',
            ].join(' ')}
          >
            {seks === 'lk' ? '👦 Standar Laki-laki' : '👧 Standar Perempuan'}
          </span>
        </div>
      </div>

      {/* Rentang Umur / Standard Selector Toolbar */}
      {aktif !== 'trenZ' && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-tinta-400">Rentang Skala:</span>
            <button
              type="button"
              onClick={() => setModeRentang('otomatis')}
              className={[
                'rounded-lg px-2.5 py-1 font-semibold transition-colors',
                modeRentang === 'otomatis'
                  ? 'bg-tinta-900 text-white'
                  : 'bg-kabut-100 text-tinta-600 hover:bg-kabut-200',
              ].join(' ')}
            >
              Fokus Kunjungan
            </button>
            <button
              type="button"
              onClick={() => setModeRentang('0-24')}
              className={[
                'rounded-lg px-2.5 py-1 font-semibold transition-colors',
                modeRentang === '0-24'
                  ? 'bg-tinta-900 text-white'
                  : 'bg-kabut-100 text-tinta-600 hover:bg-kabut-200',
              ].join(' ')}
            >
              Usia 0–24 Bulan
            </button>
            <button
              type="button"
              onClick={() => setModeRentang('0-60')}
              className={[
                'rounded-lg px-2.5 py-1 font-semibold transition-colors',
                modeRentang === '0-60'
                  ? 'bg-tinta-900 text-white'
                  : 'bg-kabut-100 text-tinta-600 hover:bg-kabut-200',
              ].join(' ')}
            >
              0–60 Bulan (Standar Lengkap)
            </button>
          </div>

          {aktif === 'bbtb' && (
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-tinta-400">Standar BB/TB:</span>
              <button
                type="button"
                onClick={() => setBasisBBTB('bbpb')}
                className={[
                  'rounded-lg px-2.5 py-1 font-semibold transition-colors',
                  basisBBTB === 'bbpb'
                    ? 'bg-laut-700 text-white'
                    : 'bg-kabut-100 text-tinta-600 hover:bg-kabut-200',
                ].join(' ')}
              >
                45–110 cm (PB Terlentang)
              </button>
              <button
                type="button"
                onClick={() => setBasisBBTB('bbtb')}
                className={[
                  'rounded-lg px-2.5 py-1 font-semibold transition-colors',
                  basisBBTB === 'bbtb'
                    ? 'bg-laut-700 text-white'
                    : 'bg-kabut-100 text-tinta-600 hover:bg-kabut-200',
                ].join(' ')}
              >
                65–120 cm (TB Berdiri)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Render Kurva Sesuai Pilihan */}
      {aktif === 'bbu' && kurvaBBU && <KurvaWHO seri={kurvaBBU} tinggi={380} />}
      {aktif === 'tbu' && kurvaTBU && <KurvaWHO seri={kurvaTBU} tinggi={380} />}
      {aktif === 'bbtb' && kurvaBBTB && <KurvaWHO seri={kurvaBBTB} tinggi={380} />}
      {aktif === 'trenZ' && kurvaTrenZ && tab.includes('trenZ') && (
        <TrenZScore seri={kurvaTrenZ} tinggi={360} />
      )}
    </div>
  )
}
