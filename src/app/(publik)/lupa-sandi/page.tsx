'use client'

import { useState } from 'react'
import Link from 'next/link'
import { mintaResetSandi } from './actions'
import { Button } from '@/components/ui/Button'
import { Mail, ArrowLeft, CheckCircle2, ShieldAlert } from 'lucide-react'

export default function HalamanLupaSandi() {
  const [sedangProses, setSedangProses] = useState(false)
  const [pesanGalat, setPesanGalat] = useState<string | null>(null)
  const [pesanSukses, setPesanSukses] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSedangProses(true)
    setPesanGalat(null)
    setPesanSukses(null)

    const formData = new FormData(e.currentTarget)
    const res = await mintaResetSandi(formData)

    setSedangProses(false)
    if (res.ok) {
      setPesanSukses(res.pesan ?? 'Tautan reset sandi telah dikirim ke email Anda.')
    } else {
      setPesanGalat(res.pesan ?? 'Gagal memproses permohonan reset sandi.')
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
            Lupa Kata Sandi?
          </h1>
          <p className="mt-1.5 text-sm text-tinta-600">
            Masukkan alamat email yang terdaftar untuk menerima tautan pemulihan kata sandi akun Anda.
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

          {pesanSukses ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl bg-aman-bg p-4 text-sm font-semibold text-aman-teks ring-1 ring-aman-garis">
                <CheckCircle2 className="size-5 shrink-0 mt-0.5" />
                <p>{pesanSukses}</p>
              </div>

              <Link
                href="/masuk"
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-laut-600 text-sm font-bold text-white shadow-md shadow-laut-600/20 hover:bg-laut-700 transition-all"
              >
                <ArrowLeft className="size-4" />
                Kembali ke Halaman Masuk
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-tinta-900">
                  Alamat Email Terdaftar <span className="text-bahaya-teks">*</span>
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

              <div className="pt-2">
                <Button type="submit" varian="utama" lebarPenuh sedangProses={sedangProses}>
                  Kirim Tautan Pemulihan
                </Button>
              </div>

              <div className="pt-2 text-center">
                <Link
                  href="/masuk"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-tinta-600 hover:text-laut-700 transition-colors"
                >
                  <ArrowLeft className="size-3.5" />
                  Batal dan kembali ke Masuk
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
