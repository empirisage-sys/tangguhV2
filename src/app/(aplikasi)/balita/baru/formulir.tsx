'use client'

import { useState } from 'react'
import { MapPin, ShieldAlert, Info } from 'lucide-react'
import { simpanBalita } from './actions'
import { Button } from '@/components/ui/Button'
import type { HasilTindakan } from '@/app/(publik)/daftar/actions'

export type PilihanPosyandu = {
  id: string
  nama: string
  desa: string | null
}

export type PropsFormulirBalitaBaru = {
  /**
   * `true` bila profil pengguna tidak terikat satu posyandu, sehingga posyandu
   * pencatatan harus dipilih di formulir. Berlaku untuk dokter dan dietisien
   * yang terdaftar di tingkat puskesmas.
   */
  perluPilihPosyandu: boolean
  /** Posyandu di bawah puskesmas pengguna. Kosong bila pengguna tidak perlu memilih. */
  daftarPosyandu: PilihanPosyandu[]
}

export function FormulirBalitaBaru({
  perluPilihPosyandu,
  daftarPosyandu,
}: PropsFormulirBalitaBaru) {
  const [sedangProses, setSedangProses] = useState(false)
  const [hasil, setHasil] = useState<HasilTindakan | null>(null)
  const [jenisKelamin, setJenisKelamin] = useState<'L' | 'P'>('L')

  // Wilayah kerja belum punya satu pun posyandu: formulir tidak mungkin diisi
  // dengan benar karena `balita.posyandu_id` bersifat NOT NULL di database.
  const wilayahKosong = perluPilihPosyandu && daftarPosyandu.length === 0

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSedangProses(true)
    setHasil(null)

    const formData = new FormData(e.currentTarget)
    formData.set('jenisKelamin', jenisKelamin)

    const res = await simpanBalita(formData)
    if (res && !res.ok) {
      setHasil(res)
      setSedangProses(false)
    }
  }

  if (wilayahKosong) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-[var(--shadow-kartu)] sm:p-8">
        <div className="flex items-start gap-3 rounded-xl bg-bahaya-bg p-4 text-sm text-bahaya-teks ring-1 ring-bahaya-garis">
          <ShieldAlert className="mt-0.5 size-5 shrink-0" />
          <div className="space-y-1">
            <p className="font-semibold">
              Belum ada posyandu terdaftar di wilayah kerja Anda.
            </p>
            <p>
              Setiap balita wajib tercatat pada satu posyandu. Mintalah admin
              menambahkan data posyandu di bawah puskesmas Anda terlebih dahulu.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-[var(--shadow-kartu)] sm:p-8">
      {hasil?.pesan && (
        <div className="mb-6 flex items-center gap-3 rounded-xl bg-bahaya-bg p-4 text-sm font-semibold text-bahaya-teks ring-1 ring-bahaya-garis">
          <ShieldAlert className="size-5 shrink-0" />
          <span>{hasil.pesan}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Posyandu pencatatan. Hanya muncul untuk peran tingkat puskesmas. */}
        {perluPilihPosyandu && (
          <div className="rounded-xl bg-laut-50 p-4 ring-1 ring-laut-200">
            <label
              htmlFor="posyanduId"
              className="flex items-center gap-2 text-sm font-semibold text-tinta-900"
            >
              <MapPin className="size-4 text-laut-600" />
              Posyandu Pencatatan <span className="text-bahaya-teks">*</span>
            </label>
            <select
              id="posyanduId"
              name="posyanduId"
              required
              defaultValue=""
              className="mt-1.5 h-12 w-full rounded-xl bg-white px-4 text-sm text-tinta-900 ring-1 ring-kabut-200 focus:ring-2 focus:ring-laut-500 focus:outline-none"
            >
              <option value="" disabled>
                — Pilih posyandu —
              </option>
              {daftarPosyandu.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.desa ? `${p.nama} — ${p.desa}` : p.nama}
                </option>
              ))}
            </select>
            <p className="mt-2 flex items-start gap-1.5 text-xs text-tinta-600">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Akun Anda terdaftar di tingkat puskesmas, sehingga posyandu
                tempat balita ini dicatat perlu ditentukan.
              </span>
            </p>
          </div>
        )}

        {/* Identitas Anak */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-tinta-400">
            1. Identitas Anak
          </h2>

          <div>
            <label htmlFor="nama" className="block text-sm font-semibold text-tinta-900">
              Nama Lengkap Balita <span className="text-bahaya-teks">*</span>
            </label>
            <input
              id="nama"
              name="nama"
              type="text"
              required
              placeholder="Contoh: Muhammad Rizky"
              className="mt-1.5 h-12 w-full rounded-xl bg-white px-4 text-sm text-tinta-900 ring-1 ring-kabut-200 focus:ring-2 focus:ring-laut-500 focus:outline-none"
            />
            {hasil?.galatMedan?.nama && (
              <p className="mt-1 text-xs text-bahaya-teks">{hasil.galatMedan.nama}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="tanggalLahir" className="block text-sm font-semibold text-tinta-900">
                Tanggal Lahir <span className="text-bahaya-teks">*</span>
              </label>
              <input
                id="tanggalLahir"
                name="tanggalLahir"
                type="date"
                required
                max={new Date().toISOString().slice(0, 10)}
                className="mt-1.5 h-12 w-full rounded-xl bg-white px-4 text-sm text-tinta-900 ring-1 ring-kabut-200 focus:ring-2 focus:ring-laut-500 focus:outline-none"
              />
              {hasil?.galatMedan?.tanggalLahir && (
                <p className="mt-1 text-xs text-bahaya-teks">{hasil.galatMedan.tanggalLahir}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-tinta-900">
                Jenis Kelamin <span className="text-bahaya-teks">*</span>
              </label>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setJenisKelamin('L')}
                  className={[
                    'flex h-12 items-center justify-center rounded-xl text-sm font-bold transition-all',
                    jenisKelamin === 'L'
                      ? 'bg-laut-600 text-white shadow-sm'
                      : 'bg-white text-tinta-600 ring-1 ring-kabut-200 hover:bg-kabut-50',
                  ].join(' ')}
                >
                  Laki-laki
                </button>
                <button
                  type="button"
                  onClick={() => setJenisKelamin('P')}
                  className={[
                    'flex h-12 items-center justify-center rounded-xl text-sm font-bold transition-all',
                    jenisKelamin === 'P'
                      ? 'bg-laut-600 text-white shadow-sm'
                      : 'bg-white text-tinta-600 ring-1 ring-kabut-200 hover:bg-kabut-50',
                  ].join(' ')}
                >
                  Perempuan
                </button>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="nik" className="block text-sm font-semibold text-tinta-900">
              Nomor Induk Kependudukan (NIK Balita)
            </label>
            <input
              id="nik"
              name="nik"
              type="text"
              maxLength={16}
              placeholder="16 digit angka (opsional)"
              className="angka mt-1.5 h-12 w-full rounded-xl bg-white px-4 text-sm text-tinta-900 ring-1 ring-kabut-200 focus:ring-2 focus:ring-laut-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Data Lahir */}
        <div className="space-y-4 pt-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-tinta-400">
            2. Data Kelahiran
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="bbLahirGram" className="block text-sm font-semibold text-tinta-900">
                Berat Lahir (Gram)
              </label>
              <input
                id="bbLahirGram"
                name="bbLahirGram"
                type="text"
                inputMode="numeric"
                placeholder="Contoh: 3100"
                className="angka mt-1.5 h-12 w-full rounded-xl bg-white px-4 text-sm text-tinta-900 ring-1 ring-kabut-200 focus:ring-2 focus:ring-laut-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="pbLahirCm" className="block text-sm font-semibold text-tinta-900">
                Panjang Lahir (cm)
              </label>
              <input
                id="pbLahirCm"
                name="pbLahirCm"
                type="text"
                inputMode="decimal"
                placeholder="Contoh: 49.0"
                className="angka mt-1.5 h-12 w-full rounded-xl bg-white px-4 text-sm text-tinta-900 ring-1 ring-kabut-200 focus:ring-2 focus:ring-laut-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Data Orang Tua & Domisili */}
        <div className="space-y-4 pt-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-tinta-400">
            3. Orang Tua &amp; Alamat
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="namaIbu" className="block text-sm font-semibold text-tinta-900">
                Nama Ibu Kandung
              </label>
              <input
                id="namaIbu"
                name="namaIbu"
                type="text"
                placeholder="Nama ibu"
                className="mt-1.5 h-12 w-full rounded-xl bg-white px-4 text-sm text-tinta-900 ring-1 ring-kabut-200 focus:ring-2 focus:ring-laut-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="namaAyah" className="block text-sm font-semibold text-tinta-900">
                Nama Ayah
              </label>
              <input
                id="namaAyah"
                name="namaAyah"
                type="text"
                placeholder="Nama ayah"
                className="mt-1.5 h-12 w-full rounded-xl bg-white px-4 text-sm text-tinta-900 ring-1 ring-kabut-200 focus:ring-2 focus:ring-laut-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="noHpOrtu" className="block text-sm font-semibold text-tinta-900">
              Nomor WhatsApp Orang Tua
            </label>
            <input
              id="noHpOrtu"
              name="noHpOrtu"
              type="tel"
              placeholder="08xxxxxxxxxx"
              className="mt-1.5 h-12 w-full rounded-xl bg-white px-4 text-sm text-tinta-900 ring-1 ring-kabut-200 focus:ring-2 focus:ring-laut-500 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="alamat" className="block text-sm font-semibold text-tinta-900">
              Alamat Domisili
            </label>
            <textarea
              id="alamat"
              name="alamat"
              rows={2}
              placeholder="Nama jalan, RT/RW, Dusun..."
              className="mt-1.5 w-full rounded-xl bg-white p-3.5 text-sm text-tinta-900 ring-1 ring-kabut-200 focus:ring-2 focus:ring-laut-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="pt-4">
          <Button type="submit" varian="utama" lebarPenuh sedangProses={sedangProses}>
            Simpan Data Balita
          </Button>
        </div>
      </form>
    </div>
  )
}
