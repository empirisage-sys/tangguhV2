/**
 * Pembacaan rujukan dari Supabase. HANYA untuk sisi server.
 *
 * Cakupan TIDAK disaring di sini: policy `baca rujukan` sudah membatasi baris
 * ke puskesmas pengaju, rumah sakit tujuan, atau admin. Galat tidak ditelan;
 * lihat catatan yang sama pada `balita-server.ts`.
 */
import { createClient } from '@/lib/supabase/server'
import type { RujukanAksesInput } from '@/lib/tampilan/akses'
import type { HasilBaca } from './balita-server'
import {
  KOLOM_RUJUKAN,
  petakanRujukan,
  type RujukanDetail,
  type RumahSakitPilihan,
} from './rujukan'

/** Tanggal hari ini menurut zona waktu Gorontalo (WITA), bukan UTC. */
export function hariIniWita(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date())
}

export async function bacaDaftarRujukan(batas = 300): Promise<HasilBaca<RujukanDetail[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('rujukan')
    .select(KOLOM_RUJUKAN)
    .order('created_at', { ascending: false })
    .limit(batas)

  if (error) return { ok: false, pesan: error.message }
  const hariIni = hariIniWita()
  return {
    ok: true,
    data: ((data ?? []) as unknown as Record<string, unknown>[]).map((b) =>
      petakanRujukan(b, hariIni),
    ),
  }
}

/**
 * Rujukan terbaru seorang balita yang belum dibatalkan, untuk banner di profil
 * balita. Mengembalikan `null` bila belum pernah dirujuk.
 */
export async function bacaRujukanTerbaruBalita(
  balitaId: string,
): Promise<HasilBaca<RujukanDetail | null>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('rujukan')
    .select(KOLOM_RUJUKAN)
    .eq('balita_id', balitaId)
    .neq('status', 'batal')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return { ok: false, pesan: error.message }
  if (!data) return { ok: true, data: null }
  return { ok: true, data: petakanRujukan(data as unknown as Record<string, unknown>, hariIniWita()) }
}

/**
 * Bentuk ringkas untuk `bolehLihatBalita`: hanya rujukan yang masih memberi
 * akses (belum dibatalkan dan masih dalam 90 hari). Galat dibaca sebagai
 * "tidak ada rujukan", karena akibatnya hanya MENYEMPITKAN tampilan, tidak
 * pernah melebarkannya; RLS tetap lapis keamanan yang sebenarnya.
 */
export async function bacaRujukanUntukAkses(): Promise<RujukanAksesInput[]> {
  const hasil = await bacaDaftarRujukan(1000)
  if (!hasil.ok) {
    console.error('[TANGGUH Rujukan] Gagal membaca rujukan untuk akses:', hasil.pesan)
    return []
  }
  return hasil.data
    .filter((r) => r.aksesAktif)
    .map((r) => ({ balitaId: r.balitaId, puskesmasId: r.puskesmasId, rsTujuanId: r.rsTujuanId }))
}

/**
 * Rumah sakit tujuan dari tabel `faskes`. Daftar statis `RUMAH_SAKIT_GORONTALO`
 * tidak dipakai lagi di sini karena id-nya ('rs-7571-01') bukan id database,
 * sehingga rujukan ke sana tidak akan pernah sampai ke spesialis anak mana pun.
 */
export async function bacaRumahSakitTujuan(): Promise<HasilBaca<RumahSakitPilihan[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('faskes')
    .select('id, nama, status')
    .eq('jenis', 'rumah_sakit')
    .order('status', { ascending: true })
    .order('nama', { ascending: true })

  if (error) return { ok: false, pesan: error.message }
  return {
    ok: true,
    data: (data ?? []).map((f) => ({
      id: String(f.id),
      nama: String(f.nama),
      status: f.status === 'usulan' ? 'usulan' : 'master',
    })),
  }
}
