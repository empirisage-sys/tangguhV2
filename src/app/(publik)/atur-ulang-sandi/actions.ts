'use server'

import { createClient } from '@/lib/supabase/server'
import { skemaAturUlangSandi } from '@/lib/validasi/pendaftaran'
import type { HasilTindakan } from '@/app/(publik)/daftar/actions'

export async function perbaruiSandiBaru(formData: FormData): Promise<HasilTindakan> {
  const hasil = skemaAturUlangSandi.safeParse({
    sandi: formData.get('sandi'),
    ulangiSandi: formData.get('ulangiSandi'),
  })

  if (!hasil.success) {
    const pesan = hasil.error.issues[0]?.message ?? 'Kata sandi belum valid.'
    return { ok: false, pesan }
  }

  const supabase = await createClient()

  try {
    const { error } = await supabase.auth.updateUser({
      password: hasil.data.sandi,
    })

    if (error) {
      console.warn('Gagal perbarui password:', error)
      return {
        ok: false,
        pesan: error.message.toLowerCase().includes('same_password')
          ? 'Kata sandi baru tidak boleh sama dengan kata sandi lama.'
          : 'Gagal memperbarui kata sandi. Pastikan sesi tautan Anda masih berlaku.',
      }
    }
  } catch (err) {
    console.error('Error updateUser password:', err)
    return { ok: false, pesan: 'Terjadi kesalahan sistem saat memperbarui kata sandi.' }
  }

  return {
    ok: true,
    pesan: 'Kata sandi Anda berhasil diperbarui! Silakan masuk dengan kata sandi baru Anda.',
  }
}
