import { garisUkur, posisiPenanda, segmenUntuk, TITIK_LABEL, zKePersen } from '@/lib/tampilan/pita'
import { formatZ } from '@/lib/tampilan/format'

/**
 * Pita Z-Score — elemen penanda visual Aplikasi TANGGUH.
 *
 * Pita horizontal bergaya garis ukur meteran antropometri, dengan penanda posisi
 * anak di antara -4 dan +4 SD. Motifnya diambil dari alat ukur yang dipakai kader
 * sendiri. Ini satu-satunya elemen yang boleh menonjol secara visual; sisa
 * antarmuka dijaga tenang.
 *
 * Seluruh perhitungan posisi ada di `src/lib/tampilan/pita.ts` dan sudah diuji.
 */

const WARNA_SEGMEN = {
  aman: 'var(--color-aman-bg)',
  waspada: 'var(--color-waspada-bg)',
  bahaya: 'var(--color-bahaya-bg)',
  netral: 'var(--color-netral-bg)',
} as const

type Props = {
  indikator: 'bbu' | 'tbu' | 'bbtb'
  z: number | null
  label: string
}

export function PitaZScore({ indikator, z, label }: Props) {
  const segmen = segmenUntuk(indikator)
  const penanda = posisiPenanda(z)

  return (
    <figure className="space-y-2">
      <figcaption className="sr-only">
        {label}: nilai Z {formatZ(z)} pada skala -4 sampai +4 simpang baku
      </figcaption>

      <div className="relative h-11 select-none">
        {/* Latar segmen warna */}
        <div className="absolute inset-x-0 top-3 flex h-5 overflow-hidden rounded-full ring-1 ring-kabut-200">
          {segmen.map((s) => (
            <div
              key={`${s.dariPersen}-${s.nada}`}
              title={s.keterangan}
              style={{
                width: `${s.sampaiPersen - s.dariPersen}%`,
                background: WARNA_SEGMEN[s.nada],
              }}
            />
          ))}
        </div>

        {/* Garis ukur, satu tiap setengah simpang baku */}
        <div className="pointer-events-none absolute inset-x-0 top-3 h-5">
          {garisUkur().map((g) => (
            <span
              key={g.persen}
              style={{ left: `${g.persen}%` }}
              className={[
                'absolute top-0 w-px -translate-x-1/2 bg-tinta-900',
                g.besar ? 'h-2.5 opacity-40' : 'h-1.5 opacity-20',
              ].join(' ')}
            />
          ))}
        </div>

        {/* Penanda posisi anak */}
        {penanda && (
          <div
            style={{ left: `${penanda.persen}%` }}
            className="absolute top-0 -translate-x-1/2"
          >
            <div className="flex flex-col items-center">
              <span className="angka rounded-md bg-tinta-900 px-1.5 py-0.5 text-xs font-bold text-white">
                {penanda.diLuarPita ? (penanda.arah === 'kiri' ? '◀ ' : '▶ ') : ''}
                {formatZ(z)}
              </span>
              <span className="h-6 w-0.5 bg-tinta-900" />
            </div>
          </div>
        )}
      </div>

      {/* Angka penunjuk skala */}
      <div className="relative h-4">
        {TITIK_LABEL.map((t) => (
          <span
            key={t}
            style={{ left: `${zKePersen(t)}%` }}
            className="angka absolute -translate-x-1/2 text-xs font-medium text-tinta-400"
          >
            {t > 0 ? `+${t}` : t}
          </span>
        ))}
      </div>
    </figure>
  )
}
