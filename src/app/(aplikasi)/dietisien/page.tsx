import { ambilProfil } from '@/lib/supabase/penjaga'
import { ambilSemuaRujukan } from '@/lib/db/rujukan'
import { bolehLihatBalita } from '@/lib/tampilan/akses'
import { bacaDaftarBalita } from '@/lib/db/balita-server'
import { PanelDietisien } from './PanelDietisien'

/**
 * Halaman dietisien.
 *
 * Pembacaan di server, penyaringan prioritas klinis di panel klien. Lihat
 * catatan Tahap 2a di `PanelDietisien`.
 */
export default async function HalamanDietisien() {
  const profil = await ambilProfil()
  const daftarRujukan = ambilSemuaRujukan()

  const hasilBaca = await bacaDaftarBalita()
  const galatBaca = hasilBaca.ok ? null : hasilBaca.pesan
  const daftarBalita = (hasilBaca.ok ? hasilBaca.data : []).filter(
    (b) => !profil || bolehLihatBalita(b, profil, daftarRujukan),
  )

  return <PanelDietisien daftarBalita={daftarBalita} galatBaca={galatBaca} />
}
