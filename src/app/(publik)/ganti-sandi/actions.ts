'use server'

/**
 * Penggantian kata sandi sementara yang dibuat administrator.
 *
 * Kata sandi diganti dengan sesi pengguna sendiri. Sesudah berhasil, penanda
 * `app_metadata.wajib_ganti_sandi` dihapus dengan klien auth admin, karena
 * `app_metadata` tidak dapat diubah dari sesi pengguna. Sesi lalu disegarkan
 * agar JWT baru tidak lagi membawa penanda itu.
 */
import { createClient } from '@/lib/supabase/server'
import { klienAuthAdmin, PESAN_KUNCI_TIDAK_ADA } from '@/lib/supabase/auth-admin'
import { skemaGantiSandiSementara } from '@/lib/validasi/pendaftaran'
import type { HasilTindakan } from '@/app/(publik)/daftar/actions'

export async function gantiSandiSementara(formData: FormData): Promise<HasilTindakan> {
  const hasil = skemaGantiSandiSementara.safeParse({
    sandiBaru: formData.get('sandiBaru'),
    ulangiSandi: formData.get('ulangiSandi'),
  })
  if (!hasil.success) {
    return { ok: false, pesan: hasil.error.issues[0]?.message ?? 'Kata sandi belum valid.' }
  }

  const supabase = await createClient()
  const { data: klaim } = await supabase.auth.getClaims()
  const penggunaId = klaim?.claims?.sub
  if (!penggunaId) {
    return { ok: false, pesan: 'Sesi Anda sudah berakhir. Masuk kembali dengan kata sandi sementara.' }
  }

  const authAdmin = klienAuthAdmin()
  if (!authAdmin) return { ok: false, pesan: PESAN_KUNCI_TIDAK_ADA }

  const { error: galatSandi } = await supabase.auth.updateUser({ password: hasil.data.sandiBaru })
  if (galatSandi) {
    const p = galatSandi.message.toLowerCase()
    return {
      ok: false,
      pesan: p.includes('same')
        ? 'Kata sandi baru tidak boleh sama dengan kata sandi sementara.'
        : 'Kata sandi belum dapat diganti. Coba lagi.',
    }
  }

  const { error: galatPenanda } = await authAdmin.updateUserById(penggunaId, {
    app_metadata: { wajib_ganti_sandi: false },
  })
  if (galatPenanda) {
    console.error('[ganti-sandi] gagal menghapus penanda', galatPenanda.message)
    return {
      ok: false,
      pesan: 'Kata sandi sudah diganti, tetapi status akun belum diperbarui. Keluar lalu masuk kembali dengan kata sandi baru.',
    }
  }

  await supabase.auth.refreshSession()
  return { ok: true, pesan: 'Kata sandi berhasil diganti.' }
}
