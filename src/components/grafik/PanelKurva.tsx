'use client'

import { useMemo, useState } from 'react'
import type { KunjunganRiwayat, SeriKurva, SeriTrenZ } from '@/lib/grafik/seri'
import {
  seriBBU,
  seriTBU,
  seriBBTB,
  seriTrenZ,
  type JenisKelamin,
} from '@/lib/grafik/seri'
import { LABEL_TAB, tabKurvaUntuk, type Peran, type TabKurva } from '@/lib/tampilan/akses'
import { KurvaWHO } from './KurvaWHO'
import { TrenZScore } from './TrenZScore'

/**
 * Panel Kurva Pertumbuhan Standar WHO 0–5 Tahun (0–60 Bulan).
 * Otomatis menampilkan kurva lengkap tanpa pembatasan skala.
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

  // Bangun kurva standar WHO 0–60 bulan (0–5 tahun)
  const kurvaBBU = useMemo(() => {
    if (riwayat.length > 0) {
      return seriBBU(riwayat, seks, [0, 60])
    }
    return initialBbu
  }, [riwayat, seks, initialBbu])

  const kurvaTBU = useMemo(() => {
    if (riwayat.length > 0) {
      return seriTBU(riwayat, seks, [0, 60])
    }
    return initialTbu
  }, [riwayat, seks, initialTbu])

  const kurvaBBTB = useMemo(() => {
    if (riwayat.length > 0) {
      return seriBBTB(riwayat, seks)
    }
    return initialBbtb
  }, [riwayat, seks, initialBbtb])

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

        {/* Lencana Otomatis Jenis Kelamin Balita */}
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

      {/* Render Kurva Standar WHO 0–5 Tahun */}
      {aktif === 'bbu' && kurvaBBU && <KurvaWHO seri={kurvaBBU} tinggi={380} />}
      {aktif === 'tbu' && kurvaTBU && <KurvaWHO seri={kurvaTBU} tinggi={380} />}
      {aktif === 'bbtb' && kurvaBBTB && <KurvaWHO seri={kurvaBBTB} tinggi={380} />}
      {aktif === 'trenZ' && kurvaTrenZ && tab.includes('trenZ') && (
        <TrenZScore seri={kurvaTrenZ} tinggi={360} />
      )}
    </div>
  )
}
