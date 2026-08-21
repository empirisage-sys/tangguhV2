'use client'

import { useState } from 'react'
import Link from 'next/link'
import { masuk } from './actions'
import { Button } from '@/components/ui/Button'
import { Lock, Mail, ShieldAlert } from 'lucide-react'

export default function HalamanMasuk() {
  const [sedangProses, setSedangProses] = useState(false)
  const [pesanGalat, setPesanGalat] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSedangProses(true)
    setPesanGalat(null)

    const formData = new FormData(e.currentTarget)
    const res = await masuk(formData)

    if (res && !res.ok) {
      setPesanGalat(res.pesan ?? 'Gagal masuk.')
      setSedangProses(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-kabut-50 px-4 py-12 sm:px-6">
      <div className="w-full max-w-md space-y-6">
        {/* Header Branding */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-laut-500 to-laut-700 text-2xl font-black text-white shadow-lg shadow-laut-500/25">
              T
            </div>
          </Link>
          <h1 className="font-display mt-4 text-2xl font-extrabold text-tinta-900 sm:text-3xl">
            Masuk sebagai Dokter/Nakes
          </h1>
          <p className="mt-1.5 text-sm text-tinta-600">
            Portal resmi Tenaga Kesehatan, Dokter Puskesmas, Dietisien, dan Kader Posyandu
          </p>
        </div>

        {/* Form Card */}
        <div className="rounded-2xl bg-white p-6 shadow-[var(--shadow-kartu)] sm:p-8">
          {pesanGalat && (
            <div className="mb-5 flex items-center gap-3 rounded-xl bg-bahaya-bg p-3.5 text-sm font-semibold text-bahaya-teks ring-1 ring-bahaya-garis">
              <ShieldAlert className="size-5 shrink-0" />
              <span>{pesanGalat}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-tinta-900">
                Alamat Email <span className="text-bahaya-teks">*</span>
              </label>
              <div className="relative mt-1.5 flex items-center">
                <Mail className="pointer-events-none absolute left-3.5 size-5 text-tinta-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="nama@puskesmas.go.id"
                  className="h-12 w-full rounded-xl bg-white pl-11 pr-4 text-sm text-tinta-900 ring-1 ring-kabut-200 transition-colors focus:ring-2 focus:ring-laut-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="sandi" className="block text-sm font-semibold text-tinta-900">
                  Kata Sandi <span className="text-bahaya-teks">*</span>
                </label>
              </div>
              <div className="relative mt-1.5 flex items-center">
                <Lock className="pointer-events-none absolute left-3.5 size-5 text-tinta-400" />
                <input
                  id="sandi"
                  name="sandi"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="Minimal 10 karakter"
                  className="h-12 w-full rounded-xl bg-white pl-11 pr-4 text-sm text-tinta-900 ring-1 ring-kabut-200 transition-colors focus:ring-2 focus:ring-laut-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2">
              <Button type="submit" varian="utama" lebarPenuh sedangProses={sedangProses}>
                Masuk Sekarang
              </Button>
            </div>
          </form>

          <div className="mt-6 border-t border-kabut-200 pt-5 text-center text-sm text-tinta-600">
            Belum pernah terdaftar sebagai Dokter / Nakes?{' '}
            <Link href="/daftar" className="font-bold text-laut-700 hover:underline">
              Registrasi di sini
            </Link>
            <div className="mt-3 rounded-xl bg-karawo-50 p-3 text-xs text-karawo-800 ring-1 ring-karawo-200">
              Atau ingin menghitung gizi &amp; PKMK tanpa akun?{' '}
              <Link href="/skrining-tamu" className="font-bold text-karawo-700 underline hover:text-karawo-900">
                Masuk sebagai Tamu →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
