import { redirect } from 'next/navigation'
import { ambilProfil } from '@/lib/supabase/penjaga'
import { pesanStatusAkun } from '@/lib/tampilan/akses'
import { keluar } from '../masuk/actions'

/**
 * Halaman untuk akun yang belum disetujui admin.
 *
 * Sejak seluruh peran wajib melalui persetujuan, kader pun berlabuh di sini
 * setelah mendaftar. Halaman ini karena itu tidak boleh terasa seperti penolakan.
 * Tiga hal wajib tersampaikan: apa yang sedang terjadi, bahwa data memang belum
 * dapat diakses, dan apa yang bisa dilakukan bila mendesak.
 *
 * Teks diambil dari `pesanStatusAkun()` agar seragam di seluruh aplikasi dan
 * teruji, bukan ditulis ulang di sini.
 */

const GAYA = {
  aman: 'bg-aman-bg text-aman-teks ring-aman-garis',
  waspada: 'bg-waspada-bg text-waspada-teks ring-waspada-garis',
  bahaya: 'bg-bahaya-bg text-bahaya-teks ring-bahaya-garis',
  netral: 'bg-netral-bg text-netral-teks ring-netral-garis',
} as const

export default async function HalamanMenunggu({
  searchParams,
}: {
  searchParams: Promise<{ baru?: string }>
}) {
  const { baru } = await searchParams
  const profil = await ambilProfil()

  if (!profil) redirect('/masuk')
  if (profil.statusAkun === 'disetujui') redirect('/dasbor')

  const pesan = pesanStatusAkun(profil.statusAkun, profil.peran, profil.alasanTolak)

  return (
    <main className="mx-auto max-w-lg space-y-5 px-5 py-10">
      {baru === '1' && (
        <div className="rounded-xl bg-laut-50 p-4 text-laut-800 ring-1 ring-laut-200">
          <p className="font-semibold">Pendaftaran berhasil dikirim</p>
          <p className="mt-1 text-sm">
            Periksa email Anda untuk menyelesaikan pendaftaran, lalu tunggu persetujuan admin.
          </p>
        </div>
      )}

      <div className={`rounded-2xl p-5 ring-1 ${GAYA[pesan.nada]}`}>
        <h1 className="text-xl font-bold">{pesan.judul}</h1>
        <p className="mt-2 leading-relaxed">{pesan.penjelasan}</p>
        {pesan.tindakan && (
          <p className="mt-3 border-t border-current/20 pt-3 text-sm leading-relaxed">
            {pesan.tindakan}
          </p>
        )}
      </div>

      <section className="rounded-2xl bg-white p-5 shadow-[var(--shadow-kartu)]">
        <h2 className="text-base font-bold text-tinta-900">Data pendaftaran Anda</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-tinta-600">Nama</dt>
            <dd className="font-semibold">{profil.namaLengkap}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-tinta-600">Peran yang diajukan</dt>
            <dd className="font-semibold capitalize">{profil.peran}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs leading-relaxed text-tinta-400">
          Bila ada data yang salah, sampaikan kepada admin. Jangan mendaftar ulang dengan email
          lain, karena akan menambah antrean verifikasi.
        </p>
      </section>

      <form action={keluar}>
        <button
          type="submit"
          className="min-h-12 w-full rounded-xl bg-white px-5 font-semibold text-laut-700 ring-1 ring-kabut-200"
        >
          Keluar
        </button>
      </form>
    </main>
  )
}
