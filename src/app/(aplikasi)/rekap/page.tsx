import { ambilProfil } from '@/lib/supabase/penjaga'
import { ambilSemuaRujukan } from '@/lib/db/rujukan'
import { bolehLihatBalita } from '@/lib/tampilan/akses'
import { bacaDaftarBalita } from '@/lib/db/balita-server'
import { PanelRekapitulasi } from './PanelRekapitulasi'

/**
 * Halaman rekapitulasi.
 *
 * Pembacaan dilakukan di server, tempat RLS berlaku, lalu diteruskan ke panel
 * klien yang menyusun angkanya. Lihat catatan Tahap 2a di `PanelRekapitulasi`.
 */
export default async function HalamanRekapitulasi() {
  const profil = await ambilProfil()
  const daftarRujukan = ambilSemuaRujukan()

  const hasilBaca = await bacaDaftarBalita()
  const galatBaca = hasilBaca.ok ? null : hasilBaca.pesan
  const daftarBalita = (hasilBaca.ok ? hasilBaca.data : []).filter(
    (b) => !profil || bolehLihatBalita(b, profil, daftarRujukan),
  )

  return <PanelRekapitulasi daftarBalita={daftarBalita} galatBaca={galatBaca} />
}
