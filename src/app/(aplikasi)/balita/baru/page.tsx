import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import {
  ambilProfil,
  perluMemilihPosyandu,
  daftarPosyanduWilayah,
} from '@/lib/supabase/penjaga'
import { FormulirBalitaBaru } from './formulir'

/**
 * Halaman ini dahulu sepenuhnya komponen klien, sehingga tidak dapat mengetahui
 * apa pun tentang profil pengguna. Akibatnya posyandu selalu diambil dari
 * `profil.posyandu_id`, dan dokter maupun dietisien — yang terdaftar di tingkat
 * puskesmas dan memang tidak memiliki `posyandu_id` — tidak pernah dapat
 * mendaftarkan balita.
 *
 * Kini pembungkusnya adalah Server Component: ia membaca profil, menentukan
 * apakah posyandu perlu dipilih, dan menyerahkan daftar pilihannya kepada
 * formulir. Keputusan tetap diverifikasi ulang di server saat penyimpanan
 * (`wilayahUntukMenulisBalita`); apa yang ada di halaman ini hanya tampilan.
 */
export default async function HalamanBalitaBaru() {
  const profil = await ambilProfil()

  const perluPilih = profil ? perluMemilihPosyandu(profil) : false
  const daftarPosyandu = perluPilih && profil ? await daftarPosyanduWilayah(profil) : []

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/balita"
          className="flex size-10 items-center justify-center rounded-xl bg-white text-tinta-600 ring-1 ring-kabut-200 hover:bg-kabut-100"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold text-tinta-900">
            Tambah Data Balita
          </h1>
          <p className="text-xs text-tinta-600">
            {perluPilih
              ? 'Pendaftaran balita baru di salah satu posyandu wilayah kerja Anda'
              : 'Pendaftaran balita baru di wilayah posyandu kerja Anda'}
          </p>
        </div>
      </div>

      <FormulirBalitaBaru
        perluPilihPosyandu={perluPilih}
        daftarPosyandu={daftarPosyandu}
      />
    </div>
  )
}
