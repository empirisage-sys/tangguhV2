import { ambilProfil } from '@/lib/supabase/penjaga'
import { ambilSemuaRujukan } from '@/lib/db/rujukan'
import { bolehLihatBalita } from '@/lib/tampilan/akses'
import { bacaDaftarBalita } from '@/lib/db/balita-server'
import { PanelVelocity } from './PanelVelocity'

/**
 * Halaman evaluasi kenaikan berat badan.
 *
 * Pembacaan di server, perhitungan seketika di panel klien. Lihat catatan
 * Tahap 2a di `PanelVelocity`.
 */
export default async function HalamanWeightIncrement() {
  const profil = await ambilProfil()
  const daftarRujukan = ambilSemuaRujukan()

  const hasilBaca = await bacaDaftarBalita()
  const galatBaca = hasilBaca.ok ? null : hasilBaca.pesan
  const daftarBalita = (hasilBaca.ok ? hasilBaca.data : []).filter(
    (b) => !profil || bolehLihatBalita(b, profil, daftarRujukan),
  )

  return <PanelVelocity daftarBalita={daftarBalita} galatBaca={galatBaca} />
}
