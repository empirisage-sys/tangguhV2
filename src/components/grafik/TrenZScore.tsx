'use client'

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { SeriTrenZ } from '@/lib/grafik/seri'
import { formatTanggal, formatZ } from '@/lib/tampilan/format'

/**
 * Tren nilai Z ketiga indikator dalam satu bidang.
 *
 * Bukan pengganti kurva WHO, melainkan pelengkap untuk dokter dan dietisien.
 * Keunggulannya: anak yang berat badannya terus bertambah tetapi nilai Z-nya
 * menurun sedang tumbuh lebih lambat daripada standar. Pada kurva berat badan
 * biasa hal itu sulit terlihat, karena garisnya tetap menanjak.
 */

const WARNA = {
  bbu: 'var(--color-laut-600)',
  tbu: 'var(--color-karawo-700)',
  bbtb: 'var(--color-bahaya-teks)',
}

export function TrenZScore({ seri, tinggi = 280 }: { seri: SeriTrenZ; tinggi?: number }) {
  return (
    <figure className="space-y-2">
      <figcaption className="text-base font-bold text-tinta-900">{seri.judul}</figcaption>

      <div style={{ height: tinggi }} className="rounded-xl bg-white p-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={seri.titik} margin={{ top: 8, right: 18, bottom: 22, left: 4 }}>
            <ReferenceArea y1={seri.domainY[0]} y2={-2} fill="var(--color-waspada-bg)" fillOpacity={1} />
            <ReferenceArea y1={seri.domainY[0]} y2={-3} fill="var(--color-bahaya-bg)" fillOpacity={1} />
            <CartesianGrid stroke="var(--color-kabut-100)" />

            <XAxis
              dataKey="umurBulan"
              type="number"
              domain={seri.domainX}
              tickCount={7}
              tick={{ fontSize: 11, fill: 'var(--color-tinta-400)' }}
              label={{
                value: 'Umur (bulan)',
                position: 'insideBottom',
                offset: -14,
                style: { fontSize: 11, fill: 'var(--color-tinta-400)' },
              }}
            />
            <YAxis
              domain={seri.domainY}
              tickCount={9}
              width={34}
              tick={{ fontSize: 11, fill: 'var(--color-tinta-400)' }}
              label={{
                value: 'Nilai Z (SD)',
                angle: -90,
                position: 'insideLeft',
                style: { fontSize: 11, fill: 'var(--color-tinta-400)' },
              }}
            />

            <ReferenceLine y={0} stroke="var(--color-laut-700)" strokeWidth={1.6} />
            <ReferenceLine y={-2} stroke="var(--color-tinta-600)" strokeDasharray="4 3" />
            <ReferenceLine y={-3} stroke="var(--color-bahaya-teks)" strokeDasharray="4 3" />

            <Line dataKey="bbu" name="BB/U" stroke={WARNA.bbu} strokeWidth={2.2} dot={{ r: 3.6 }} connectNulls />
            <Line dataKey="tbu" name="TB/U" stroke={WARNA.tbu} strokeWidth={2.2} dot={{ r: 3.6 }} connectNulls />
            <Line dataKey="bbtb" name="BB/TB" stroke={WARNA.bbtb} strokeWidth={2.2} dot={{ r: 3.6 }} connectNulls />

            <Legend verticalAlign="top" height={26} iconType="plainline" wrapperStyle={{ fontSize: 12 }} />

            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0]?.payload as SeriTrenZ['titik'][number] | undefined
                if (!d) return null
                return (
                  <div className="rounded-lg bg-tinta-900 px-3 py-2 text-xs text-white shadow-lg">
                    <p className="font-semibold">{formatTanggal(d.tanggal)}</p>
                    <p className="angka">BB/U {formatZ(d.bbu)}</p>
                    <p className="angka">TB/U {formatZ(d.tbu)}</p>
                    <p className="angka">BB/TB {formatZ(d.bbtb)}</p>
                  </div>
                )
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {seri.catatan.length > 0 && (
        <ul className="space-y-1 text-xs leading-relaxed text-tinta-400">
          {seri.catatan.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      )}
    </figure>
  )
}
