import { ambilProfil } from '@/lib/supabase/penjaga'
import { bacaDaftarRujukan } from '@/lib/db/rujukan-server'
import { PanelRujukan } from './PanelRujukan'

/**
 * Halaman Pasien Rujukan.
 *
 * Sebelumnya halaman ini adalah komponen klien yang membaca senarai rujukan di
 * memori peramban, sehingga selalu kosong bagi rumah sakit. Kini rujukan dibaca
 * di server dari tabel `rujukan`; policy `baca rujukan` membatasi barisnya ke
 * puskesmas pengaju, rumah sakit tujuan, atau admin.
 */
export default async function HalamanPasienRujukan() {
  const [profil, hasil] = await Promise.all([ambilProfil(), bacaDaftarRujukan()])

  return (
    <PanelRujukan
      daftarRujukan={hasil.ok ? hasil.data : []}
      galatBaca={hasil.ok ? null : hasil.pesan}
      peran={profil?.peran ?? null}
      namaPengguna={profil?.namaLengkap}
    />
  )
}
