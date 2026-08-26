'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Baby,
  Utensils,
  FileSpreadsheet,
  ShieldCheck,
  Hospital,
  LogOut,
  User,
  TrendingUp,
  Users,
} from 'lucide-react'
import type { Peran } from '@/lib/tampilan/akses'

type NavItem = {
  id: string
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  peranBoleh: Peran[]
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'dasbor',
    label: 'Dasbor',
    href: '/dasbor',
    icon: LayoutDashboard,
    peranBoleh: ['kader', 'dokter', 'dokter_spesialis_anak', 'dietisien', 'admin'],
  },
  {
    id: 'balita',
    label: 'Data Balita',
    href: '/balita',
    icon: Baby,
    peranBoleh: ['kader', 'dokter', 'dokter_spesialis_anak', 'dietisien', 'admin'],
  },
  {
    id: 'velocity',
    label: 'Weight Increment',
    href: '/velocity',
    icon: TrendingUp,
    peranBoleh: ['kader', 'dokter', 'dokter_spesialis_anak', 'dietisien', 'admin'],
  },
  {
    id: 'rujukan',
    label: 'Pasien Rujukan',
    href: '/rujukan',
    icon: Hospital,
    peranBoleh: ['dokter', 'dokter_spesialis_anak', 'dietisien', 'admin'],
  },
  {
    id: 'dietisien',
    label: 'Dietisien & PKMK',
    href: '/dietisien',
    icon: Utensils,
    peranBoleh: ['dietisien', 'dokter', 'dokter_spesialis_anak', 'admin'],
  },
  {
    id: 'rekap',
    label: 'Rekapitulasi',
    href: '/rekap',
    icon: FileSpreadsheet,
    peranBoleh: ['kader', 'dokter', 'dokter_spesialis_anak', 'dietisien', 'admin'],
  },
  {
    id: 'verifikasi',
    label: 'Verifikasi',
    href: '/admin/verifikasi',
    icon: ShieldCheck,
    peranBoleh: ['admin'],
  },
  {
    id: 'pengguna',
    label: 'Manajemen Akun',
    href: '/admin/pengguna',
    icon: Users,
    peranBoleh: ['admin'],
  },
]

const LABEL_PERAN_BADGE: Record<Peran, { label: string; kelas: string }> = {
  kader: { label: 'Kader Posyandu', kelas: 'bg-laut-100 text-laut-800' },
  dokter: { label: 'Dokter Puskesmas', kelas: 'bg-aman-bg text-aman-teks' },
  dokter_spesialis_anak: { label: 'Dokter Spesialis Anak', kelas: 'bg-indigo-100 text-indigo-800' },
  dietisien: { label: 'Dietisien / Nutrisionis', kelas: 'bg-karawo-100 text-karawo-700' },
  admin: { label: 'Admin', kelas: 'bg-tinta-900 text-white' },
}

type Props = {
  profil: {
    namaLengkap: string
    peran: Peran
    kabupatenNama?: string
  }
}

export function NavigasiUtama({ profil }: Props) {
  const pathname = usePathname()
  const roleBadge = LABEL_PERAN_BADGE[profil.peran]

  const itemsDiizinkan = NAV_ITEMS.filter((item) =>
    item.peranBoleh.includes(profil.peran),
  )

  return (
    <>
      {/* Topbar Desktop & Mobile Header */}
      <header className="sticky top-0 z-30 border-b border-kabut-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-6">
            <Link href="/dasbor" className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-laut-500 to-laut-700 text-lg font-black text-white shadow-md shadow-laut-500/20">
                T
              </div>
              <div>
                <span className="font-display text-lg font-extrabold tracking-tight text-laut-900">
                  TANGGUH
                </span>
                <span className="ml-1.5 hidden text-xs font-semibold text-tinta-400 sm:inline">
                  Provinsi Gorontalo
                </span>
                <p className="hidden text-[11px] text-tinta-400 sm:block">
                  Deteksi Dini & Intervensi Stunting Balita
                </p>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex md:items-center md:gap-1">
              {itemsDiizinkan.map((item) => {
                const Icon = item.icon
                const aktif =
                  item.href === '/dasbor'
                    ? pathname === '/dasbor'
                    : pathname.startsWith(item.href)

                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={[
                      'flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all',
                      aktif
                        ? 'bg-laut-50 text-laut-700 shadow-[inset_0_-2px_0_var(--color-karawo-400)]'
                        : 'text-tinta-600 hover:bg-kabut-100 hover:text-tinta-900',
                    ].join(' ')}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </div>

          {/* User Profile & Logout */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-full bg-kabut-100 text-tinta-600">
                <User className="size-4" />
              </div>
              <div className="hidden text-right text-xs sm:block">
                <p className="font-bold text-tinta-900">{profil.namaLengkap}</p>
                <span
                  className={[
                    'inline-block rounded-full px-2 py-0.5 text-[10px] font-bold',
                    roleBadge.kelas,
                  ].join(' ')}
                >
                  {roleBadge.label}
                </span>
              </div>
            </div>

            <form action="/auth/keluar" method="POST">
              <button
                type="submit"
                title="Keluar"
                className="flex size-9 items-center justify-center rounded-xl text-tinta-400 transition-colors hover:bg-bahaya-bg hover:text-bahaya-teks"
              >
                <LogOut className="size-4" />
                <span className="sr-only">Keluar</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar (Thumb-friendly) */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-kabut-200 bg-white/95 pb-safe backdrop-blur-md md:hidden">
        {itemsDiizinkan.map((item) => {
          const Icon = item.icon
          const aktif =
            item.href === '/dasbor'
              ? pathname === '/dasbor'
              : pathname.startsWith(item.href)

          return (
            <Link
              key={item.id}
              href={item.href}
              className={[
                'flex flex-1 flex-col items-center justify-center py-2.5 text-[11px] font-semibold transition-colors',
                aktif
                  ? 'bg-laut-50 text-laut-700 shadow-[inset_0_3px_0_var(--color-karawo-400)]'
                  : 'text-tinta-400 hover:text-tinta-900',
              ].join(' ')}
            >
              <Icon className="size-5" />
              <span className="mt-1">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
