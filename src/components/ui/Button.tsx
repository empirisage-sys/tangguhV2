import { Loader2 } from 'lucide-react'

/**
 * Tombol.
 *
 * Tinggi minimum 48 px, sesuai ukuran sasaran sentuh yang nyaman ditekan sambil
 * menggendong anak. Varian `bahaya` hanya untuk tindakan merusak, bukan untuk
 * status gizi.
 */
type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  varian?: 'utama' | 'sekunder' | 'halus' | 'bahaya'
  sedangProses?: boolean
  lebarPenuh?: boolean
}

const VARIAN = {
  utama: 'bg-laut-600 text-white hover:bg-laut-700 active:bg-laut-800',
  sekunder: 'bg-white text-laut-700 ring-1 ring-kabut-200 hover:bg-kabut-50',
  halus: 'bg-transparent text-laut-700 hover:bg-laut-50',
  bahaya: 'bg-bahaya-teks text-white hover:opacity-90',
} as const

export function Button({
  varian = 'utama',
  sedangProses = false,
  lebarPenuh = false,
  disabled,
  children,
  className = '',
  ...sisa
}: Props) {
  return (
    <button
      {...sisa}
      disabled={disabled || sedangProses}
      className={[
        'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5',
        'text-base font-semibold transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        lebarPenuh ? 'w-full' : '',
        VARIAN[varian],
        className,
      ].join(' ')}
    >
      {sedangProses && <Loader2 className="size-5 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}
