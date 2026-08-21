import { CircleCheck, CircleHelp, OctagonAlert, TriangleAlert } from 'lucide-react'
import type { NamaIkon, TampilanStatus } from '@/lib/tampilan/status'

/**
 * Lencana status klinis.
 *
 * Wajib memuat tiga hal sekaligus: warna, ikon, dan teks. Sekitar delapan persen
 * laki-laki mengalami gangguan penglihatan warna, dan layar ponsel di bawah
 * matahari mengurangi perbedaan warna. Status yang hanya dibedakan warna akan
 * terbaca keliru di lapangan.
 */

const IKON = {
  'circle-check': CircleCheck,
  'triangle-alert': TriangleAlert,
  'octagon-alert': OctagonAlert,
  'circle-help': CircleHelp,
} satisfies Record<NamaIkon, React.ComponentType<{ className?: string }>>

const GAYA = {
  aman: 'bg-aman-bg text-aman-teks ring-aman-garis',
  waspada: 'bg-waspada-bg text-waspada-teks ring-waspada-garis',
  bahaya: 'bg-bahaya-bg text-bahaya-teks ring-bahaya-garis',
  netral: 'bg-netral-bg text-netral-teks ring-netral-garis',
} as const

type Props = {
  status: TampilanStatus
  ukuran?: 'kecil' | 'besar'
}

export function LencanaStatus({ status, ukuran = 'besar' }: Props) {
  const Ikon = IKON[status.ikon]
  const kecil = ukuran === 'kecil'

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full font-semibold ring-1',
        kecil ? 'px-2.5 py-1 text-sm' : 'px-3.5 py-2 text-base',
        GAYA[status.nada],
      ].join(' ')}
    >
      <Ikon className={kecil ? 'size-4 shrink-0' : 'size-5 shrink-0'} aria-hidden />
      {status.label}
    </span>
  )
}
