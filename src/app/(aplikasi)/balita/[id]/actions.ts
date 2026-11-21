'use server'

/**
 * Hapus lunak balita. Seluruh aturan (wewenang sesuai cakupan, alasan minimal
 * 10 karakter, tidak ada rujukan berjalan) ditegakkan fungsi database
 * `hapus_balita`, sehingga tidak ada pemanggil yang dapat melewatinya.
 */
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { wajibPeran, TidakBerwenangError } from '@/lib/supabase/penjaga'
import type { HasilTindakan } from '@/app/(publik)/daftar/actions'

const skema = z.object({
  balitaId: z.string().uuid('Balita tidak dikenal.'),
  alasan: z.string().trim().min(10, 'Alasan penghapusan wajib diisi minimal 10 karakter.').max(500),
})

export async function hapusBalita(balitaId: string, alasan: string): Promise<HasilTindakan> {
  try {
    await wajibPeran(['kader', 'dokter', 'dokter_spesialis_anak', 'dietisien', 'admin'])
  } catch (galat) {
    if (galat instanceof TidakBerwenangError) return { ok: false, pesan: galat.message }
    throw galat
  }

  const hasil = skema.safeParse({ balitaId, alasan })
  if (!hasil.success) return { ok: false, pesan: hasil.error.issues[0]?.message ?? 'Isian belum lengkap.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('hapus_balita', {
    p_balita_id: hasil.data.balitaId,
    p_alasan: hasil.data.alasan,
  })
  if (error) {
    // Pesan dari fungsi database sudah berbahasa Indonesia dan dapat ditindaklanjuti.
    const pesan = error.message.includes('function') && error.message.includes('does not exist')
      ? 'Fitur hapus balita belum aktif: migrasi 20261123010000_hapus_balita.sql belum dijalankan.'
      : error.message
    return { ok: false, pesan }
  }

  revalidatePath('/balita')
  revalidatePath('/dasbor')
  revalidatePath('/rekap')
  return { ok: true, pesan: 'Data balita sudah dihapus.' }
}
