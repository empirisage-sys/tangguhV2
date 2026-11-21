'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, ShieldAlert, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { gantiSandiSementara } from './actions'

/**
 * Halaman wajib bagi akun yang dibuat administrator dengan kata sandi
 * sementara. `proxy.ts` mengalihkan setiap halaman lain ke sini sampai kata
 * sandi diganti.
 */
export default function HalamanGantiSandi() {
  const router = useRouter()
  const [sedangProses, setSedangProses] = useState(false)
  const [pesanGalat, setPesanGalat] = useState<string | null>(null)

  const kirim = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSedangProses(true)
    setPesanGalat(null)
    const res = await gantiSandiSementara(new FormData(e.currentTarget))
    setSedangProses(false)
    if (res.ok) {
      router.replace('/dasbor')
      router.refresh()
    } else {
      setPesanGalat(res.pesan ?? 'Kata sandi belum dapat diganti.')
    }
  }

  const kelasInput =
    'h-12 w-full rounded-xl bg-white pl-11 pr-4 text-sm text-tinta-900 ring-1 ring-kabut-200 focus:ring-2 focus:ring-laut-500 focus:outline-none'

  return (
    <div className="flex min-h-screen items-center justify-center bg-kabut-50 px-4 py-12 sm:px-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-laut-500 to-laut-700 text-white shadow-lg shadow-laut-500/25">
            <KeyRound className="size-6" />
          </div>
          <h1 className="font-display mt-4 text-2xl font-extrabold text-tinta-900">
            Ganti Kata Sandi Sementara
          </h1>
          <p className="mt-1.5 text-sm text-tinta-600">
            Akun Anda dibuat oleh administrator. Demi keamanan data pasien, buat kata sandi
            pribadi sebelum memakai aplikasi.
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-[var(--shadow-kartu)] sm:p-8">
          {pesanGalat && (
            <div role="alert" className="mb-5 flex items-center gap-3 rounded-xl bg-bahaya-bg p-3.5 text-sm font-semibold text-bahaya-teks ring-1 ring-bahaya-garis">
              <ShieldAlert className="size-5 shrink-0" />
              <span>{pesanGalat}</span>
            </div>
          )}
          <form onSubmit={kirim} className="space-y-4">
            <div>
              <label htmlFor="sandiBaru" className="block text-sm font-semibold text-tinta-900">
                Kata Sandi Baru
              </label>
              <div className="relative mt-1.5 flex items-center">
                <Lock className="pointer-events-none absolute left-3.5 size-5 text-tinta-400" />
                <input id="sandiBaru" name="sandiBaru" type="password" required minLength={8}
                  autoComplete="new-password" placeholder="Minimal 8 karakter" className={kelasInput} />
              </div>
            </div>
            <div>
              <label htmlFor="ulangiSandi" className="block text-sm font-semibold text-tinta-900">
                Ulangi Kata Sandi Baru
              </label>
              <div className="relative mt-1.5 flex items-center">
                <Lock className="pointer-events-none absolute left-3.5 size-5 text-tinta-400" />
                <input id="ulangiSandi" name="ulangiSandi" type="password" required minLength={8}
                  autoComplete="new-password" placeholder="Ketik ulang kata sandi baru" className={kelasInput} />
              </div>
            </div>
            <Button type="submit" varian="utama" lebarPenuh sedangProses={sedangProses}>
              Simpan dan Lanjutkan
            </Button>
          </form>
          <form action="/auth/keluar" method="POST" className="mt-3 text-center">
            <button type="submit" className="text-xs font-bold text-tinta-500 hover:text-laut-700">
              Keluar
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
