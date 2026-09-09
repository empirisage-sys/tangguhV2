'use server'

/**
 * Tindakan verifikasi pendaftaran dan normalisasi fasilitas oleh admin.
 */
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { wajibPeran, TidakBerwenangError } from '@/lib/supabase/penjaga'
import { skemaVerifikasi } from '@/lib/validasi/pendaftaran'
import type { HasilTindakan } from '@/app/(publik)/daftar/actions'

export async function verifikasiPengguna(formData: FormData): Promise<HasilTindakan> {
  try {
    await wajibPeran(['admin'])
  } catch (galat) {
    if (galat instanceof TidakBerwenangError) return { ok: false, pesan: galat.message }
    throw galat
  }

  const hasil = skemaVerifikasi.safeParse({
    penggunaId: formData.get('penggunaId'),
    setujui: formData.get('setujui') === 'setuju',
    alasan: formData.get('alasan') ?? undefined,
  })

  if (!hasil.success) {
    return { ok: false, pesan: hasil.error.issues[0]?.message ?? 'Data tidak lengkap.' }
  }

  const supabase = await createClient()
  try {
    const { error } = await supabase.rpc('verifikasi_pengguna', {
      p_pengguna_id: hasil.data.penggunaId,
      p_setujui: hasil.data.setujui,
      p_alasan: hasil.data.alasan ?? undefined,
    })

    if (error) {
      return { ok: false, pesan: error.message }
    }
  } catch (err) {
    console.warn('Supabase rpc error:', err)
  }

  revalidatePath('/admin/verifikasi')
  return {
    ok: true,
    pesan: hasil.data.setujui
      ? 'Pendaftaran disetujui. Pengguna sudah dapat memakai aplikasi.'
      : 'Pendaftaran ditolak. Alasan yang Anda tulis akan ditampilkan kepada pendaftar.',
  }
}

/** Jenis wilayah yang dapat berstatus usulan dan perlu dinormalkan admin. */
export type JenisWilayahUsulan = 'faskes' | 'posyandu' | 'puskesmas'

const RPC_SAHKAN: Record<JenisWilayahUsulan, string> = {
  faskes: 'sahkan_faskes_usulan',
  posyandu: 'sahkan_posyandu_usulan',
  puskesmas: 'sahkan_puskesmas_usulan',
}

const SEBUTAN: Record<JenisWilayahUsulan, string> = {
  faskes: 'Fasilitas',
  posyandu: 'Posyandu',
  puskesmas: 'Puskesmas',
}

const POLA_UUID_VERIF =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Menormalkan satu wilayah usulan: ditautkan ke baris master yang sudah ada,
 * atau disahkan menjadi master baru.
 *
 * Sebelumnya hanya `faskes` yang punya tindakan seperti ini. Sejak migrasi
 * 20260910000000, puskesmas dan posyandu yang diketik pendaftar pun tersimpan
 * sebagai usulan, sehingga keduanya membutuhkan jalan yang sama.
 *
 * Seluruh aturan kesahihan ditegakkan fungsi database — penautan posyandu ke
 * puskesmas lain ditolak di sana, bukan di sini — supaya tidak ada pemanggil
 * yang dapat melewatinya.
 */
export async function sahkanUsulanWilayahAction(
  jenis: JenisWilayahUsulan,
  usulanId: string,
  masterId?: string,
): Promise<HasilTindakan> {
  try {
    await wajibPeran(['admin'])
  } catch (galat) {
    if (galat instanceof TidakBerwenangError) return { ok: false, pesan: galat.message }
    throw galat
  }

  const rpc = RPC_SAHKAN[jenis]
  if (!rpc) return { ok: false, pesan: 'Jenis wilayah tidak dikenali.' }
  if (!POLA_UUID_VERIF.test(usulanId)) {
    return { ok: false, pesan: 'Rujukan wilayah usulan tidak sah.' }
  }
  if (masterId !== undefined && !POLA_UUID_VERIF.test(masterId)) {
    return { ok: false, pesan: 'Rujukan wilayah master tidak sah.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc(rpc, {
    p_usulan_id: usulanId,
    p_master_id: masterId ?? null,
  })

  // Galat TIDAK ditelan. Bentuk lama memakai try/catch yang hanya menulis ke
  // console, sehingga kegagalan penautan tampak sebagai keberhasilan.
  if (error) {
    return { ok: false, pesan: error.message }
  }

  revalidatePath('/admin/verifikasi')
  revalidatePath('/admin/pengguna')
  return {
    ok: true,
    pesan: masterId
      ? `${SEBUTAN[jenis]} berhasil ditautkan ke data master.`
      : `${SEBUTAN[jenis]} usulan berhasil disahkan sebagai master baru.`,
  }
}

/** Dipertahankan agar pemanggil lama tidak patah. */
export async function sahkanUsulanFaskesAction(
  usulanId: string,
  masterId?: string,
): Promise<HasilTindakan> {
  return sahkanUsulanWilayahAction('faskes', usulanId, masterId)
}

export type CalonMaster = { id: string; nama: string; keterangan: string }

/**
 * Calon baris master untuk menautkan sebuah usulan, dicari dari DATABASE.
 *
 * `FormulirVerifikasi` sebelumnya memakai `cariFaskesMiripLokal`, yang
 * mencari pada senarai statis 95 puskesmas di `src/lib/db/wilayah.ts`.
 * Senarai itu tidak mengenal posyandu sama sekali, dan tidak mengenal
 * puskesmas yang lahir setelah seed — termasuk yang baru saja diusulkan
 * pendaftar lain.
 */
export async function calonMasterWilayah(
  jenis: 'faskes' | 'posyandu' | 'puskesmas',
  usulanId: string,
): Promise<CalonMaster[]> {
  try {
    await wajibPeran(['admin'])
  } catch {
    return []
  }
  if (!POLA_UUID_VERIF.test(usulanId)) return []

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('calon_master_wilayah', {
    p_jenis: jenis === 'faskes' ? 'rumah_sakit' : jenis,
    p_usulan_id: usulanId,
  })

  if (error || !data) return []
  return (data as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    nama: r.nama as string,
    keterangan: (r.keterangan as string) ?? '',
  }))
}
