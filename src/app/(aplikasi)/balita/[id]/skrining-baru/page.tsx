import { notFound } from 'next/navigation'
import { ambilProfil } from '@/lib/supabase/penjaga'
import { ambilSemuaRujukan } from '@/lib/db/rujukan'
import { bolehLihatBalita } from '@/lib/tampilan/akses'
import { bacaBalitaById } from '@/lib/db/balita-server'
import { FormulirSkriningBaru } from './FormulirSkriningBaru'

/**
 * Halaman pencatatan skrining baru.
 *
 * ==========================================================================
 * TAHAP 2a: PEMBACAAN DIPINDAHKAN KE SISI SERVER
 *
 * Sebelumnya seluruh halaman ini adalah komponen klien yang mencari balita di
 * `SAMPLE_BALITA_DATABASE`. Senarai itu kosong, jadi jalur pencatatan skrining
 * — inti aplikasi ini — tidak pernah dapat dipakai sekali pun: halaman selalu
 * berakhir pada "Data Balita Tidak Ditemukan".
 *
 * Sekarang balitanya dibaca di server, tempat RLS berlaku, lalu diteruskan
 * sebagai prop. Formulirnya tetap komponen klien, karena hasil hitung seketika
 * dan antrean offline memang harus berjalan di perangkat kader.
 * ==========================================================================
 */
export default async function HalamanSkriningBaru({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const hasilBaca = await bacaBalitaById(id)

  // Kegagalan database dibedakan dari balita yang tidak ada. Bila keduanya
  // menjadi 404, kader akan menyimpulkan balitanya belum terdaftar lalu
  // mendaftarkannya kembali — menghasilkan data ganda.
  if (!hasilBaca.ok) {
    throw new Error(`Gagal membaca data balita: ${hasilBaca.pesan}`)
  }

  const balita = hasilBaca.data
  if (!balita) notFound()

  const profil = await ambilProfil()
  if (profil && !bolehLihatBalita(balita, profil, ambilSemuaRujukan())) {
    notFound()
  }

  return <FormulirSkriningBaru balita={balita} />
}
