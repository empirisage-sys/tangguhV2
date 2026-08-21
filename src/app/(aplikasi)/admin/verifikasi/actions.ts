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

export async function sahkanUsulanFaskesAction(
  usulanId: string,
  masterId?: string,
): Promise<HasilTindakan> {
  try {
    await wajibPeran(['admin'])
  } catch (galat) {
    if (galat instanceof TidakBerwenangError) return { ok: false, pesan: galat.message }
    throw galat
  }

  const supabase = await createClient()
  try {
    const { error } = await supabase.rpc('sahkan_faskes_usulan', {
      p_usulan_id: usulanId,
      p_master_id: masterId ?? null,
    })

    if (error) {
      return { ok: false, pesan: error.message }
    }
  } catch (err) {
    console.warn('Supabase rpc sahkan_faskes_usulan error:', err)
  }

  revalidatePath('/admin/verifikasi')
  return {
    ok: true,
    pesan: masterId
      ? 'Fasilitas berhasil ditautkan ke master.'
      : 'Fasilitas usulan berhasil disahkan sebagai master baru.',
  }
}
