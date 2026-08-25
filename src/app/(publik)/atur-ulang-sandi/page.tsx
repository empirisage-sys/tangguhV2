'use client'

import { useState } from 'react'
import Link from 'next/link'
import { perbaruiSandiBaru } from './actions'
import { Button } from '@/components/ui/Button'
import { Lock, ArrowLeft, CheckCircle2, ShieldAlert } from 'lucide-react'

export default function HalamanAturUlangSandi() {
  const [sedangProses, setSedangProses] = useState(false)
  const [pesanGalat, setPesanGalat] = useState<string | null>(null)
  const [pesanSukses, setPesanSukses] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSedangProses(true)
    setPesanGalat(null)
    setPesanSukses(null)

    const formData = new FormData(e.currentTarget)
    const res = await perbaruiSandiBaru(formData)

    setSedangProses(false)
    if (res.ok) {
      setPesanSukses(res.pesan ?? 'Kata sandi berhasil diatur ulang.')
    } else {
      setPesanGalat(res.pesan ?? 'Gagal memperbarui kata sandi.')
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
            Atur Ulang Kata Sandi
          </h1>
          <p className="mt-1.5 text-sm text-tinta-600">
            Buat kata sandi baru untuk akun Anda (minimal 8 karakter).
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
                Masuk dengan Kata Sandi Baru
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="sandi" className="block text-sm font-semibold text-tinta-900">
                  Kata Sandi Baru <span className="text-bahaya-teks">*</span>
                </label>
                <div className="relative mt-1.5 flex items-center">
                  <Lock className="pointer-events-none absolute left-3.5 size-5 text-tinta-400" />
                  <input
                    id="sandi"
                    name="sandi"
                    type="password"
                    required
                    placeholder="Minimal 8 karakter"
                    className="h-12 w-full rounded-xl bg-white pl-11 pr-4 text-sm text-tinta-900 ring-1 ring-kabut-200 transition-colors focus:ring-2 focus:ring-laut-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="ulangiSandi" className="block text-sm font-semibold text-tinta-900">
                  Ulangi Kata Sandi Baru <span className="text-bahaya-teks">*</span>
                </label>
                <div className="relative mt-1.5 flex items-center">
                  <Lock className="pointer-events-none absolute left-3.5 size-5 text-tinta-400" />
                  <input
                    id="ulangiSandi"
                    name="ulangiSandi"
                    type="password"
                    required
                    placeholder="Ketik ulang kata sandi baru"
                    className="h-12 w-full rounded-xl bg-white pl-11 pr-4 text-sm text-tinta-900 ring-1 ring-kabut-200 transition-colors focus:ring-2 focus:ring-laut-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button type="submit" varian="utama" lebarPenuh sedangProses={sedangProses}>
                  Simpan Kata Sandi Baru
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
