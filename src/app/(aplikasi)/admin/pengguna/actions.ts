'use server'

/**
 * Tindakan Server untuk Manajemen Pengguna oleh Administrator:
 * - Edit data akun & hak akses
 * - Hapus akun pengguna secara permanen (dengan pengamanan)
 * - Reset kata sandi manual langsung oleh Administrator
 */
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { wajibPeran, TidakBerwenangError } from '@/lib/supabase/penjaga'
import {
  normalkanNoHp,
  skemaEditPenggunaAdmin,
  skemaResetSandiAdmin,
} from '@/lib/validasi/pendaftaran'
import type { HasilTindakan } from '@/app/(publik)/daftar/actions'

export async function adminEditPengguna(formData: FormData): Promise<HasilTindakan> {
  try {
    await wajibPeran(['admin'])
  } catch (galat) {
    if (galat instanceof TidakBerwenangError) return { ok: false, pesan: galat.message }
    throw galat
  }

  const hasil = skemaEditPenggunaAdmin.safeParse({
    penggunaId: formData.get('penggunaId'),
    namaLengkap: formData.get('namaLengkap'),
    role: formData.get('role'),
    statusAkun: formData.get('statusAkun'),
    noHp: formData.get('noHp') ?? '',
    noStr: formData.get('noStr') ?? '',
  })

  if (!hasil.success) {
    return {
      ok: false,
      pesan: hasil.error.issues[0]?.message ?? 'Data yang dimasukkan tidak valid.',
    }
  }

  const d = hasil.data
  const supabase = await createClient()

  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        nama_lengkap: d.namaLengkap,
        role: d.role as any,
        status_akun: d.statusAkun as any,
        no_hp: d.noHp ? normalkanNoHp(d.noHp) : null,
        no_str: d.noStr ? d.noStr.trim() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', d.penggunaId)

    if (error) {
      console.warn('Gagal update profile oleh admin:', error)
      return { ok: false, pesan: `Gagal memperbarui profil: ${error.message}` }
    }
  } catch (err: any) {
    console.error('Error adminEditPengguna:', err)
    return { ok: false, pesan: err.message || 'Terjadi kesalahan sistem saat memperbarui data.' }
  }

  revalidatePath('/admin/pengguna')
  revalidatePath('/admin/verifikasi')
  return {
    ok: true,
    pesan: `Data akun "${d.namaLengkap}" berhasil diperbarui.`,
  }
}

export async function adminHapusPengguna(penggunaId: string): Promise<HasilTindakan> {
  try {
    await wajibPeran(['admin'])
  } catch (galat) {
    if (galat instanceof TidakBerwenangError) return { ok: false, pesan: galat.message }
    throw galat
  }

  if (!penggunaId) {
    return { ok: false, pesan: 'ID pengguna tidak valid.' }
  }

  const supabase = await createClient()

  // Cegah admin menghapus akunnya sendiri
  const { data: userAuth } = await supabase.auth.getUser()
  if (userAuth?.user?.id === penggunaId) {
    return {
      ok: false,
      pesan: 'Anda tidak dapat menghapus akun Administrator Anda sendiri yang sedang aktif digunakan.',
    }
  }

  try {
    // Hapus data profil
    const { error: errProfil } = await supabase
      .from('profiles')
      .delete()
      .eq('id', penggunaId)

    if (errProfil) {
      console.warn('Gagal hapus profil:', errProfil)
      return { ok: false, pesan: `Gagal menghapus data akun: ${errProfil.message}` }
    }

    // Jika service role key tersedia di server environment, hapus juga akun otentikasi auth.users
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (serviceKey && process.env.NEXT_PUBLIC_SUPABASE_URL) {
      try {
        const adminAuth = createSupabaseClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          serviceKey,
          { auth: { autoRefreshToken: false, persistSession: false } }
        )
        await adminAuth.auth.admin.deleteUser(penggunaId)
      } catch (authDelErr) {
        console.warn('Hapus auth user fallback warning:', authDelErr)
      }
    }
  } catch (err: any) {
    console.error('Error adminHapusPengguna:', err)
    return { ok: false, pesan: err.message || 'Terjadi kesalahan sistem saat menghapus akun.' }
  }

  revalidatePath('/admin/pengguna')
  revalidatePath('/admin/verifikasi')
  return {
    ok: true,
    pesan: 'Akun pengguna berhasil dihapus secara permanen dari sistem.',
  }
}

export async function adminResetPasswordManual(
  penggunaId: string,
  sandiBaru: string,
): Promise<HasilTindakan> {
  try {
    await wajibPeran(['admin'])
  } catch (galat) {
    if (galat instanceof TidakBerwenangError) return { ok: false, pesan: galat.message }
    throw galat
  }

  const hasil = skemaResetSandiAdmin.safeParse({
    penggunaId,
    sandiBaru,
  })

  if (!hasil.success) {
    return {
      ok: false,
      pesan: hasil.error.issues[0]?.message ?? 'Kata sandi baru minimal 8 karakter.',
    }
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!serviceKey || !supabaseUrl) {
    return {
      ok: false,
      pesan: 'Konfigurasi kunci server belum tersedia untuk reset password instan. Silakan gunakan alur Lupa Sandi atau hubungi teknisi database.',
    }
  }

  try {
    const adminAuth = createSupabaseClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { error } = await adminAuth.auth.admin.updateUserById(penggunaId, {
      password: hasil.data.sandiBaru,
    })

    if (error) {
      console.warn('Gagal reset password user by admin:', error)
      return { ok: false, pesan: `Gagal mereset kata sandi: ${error.message}` }
    }
  } catch (err: any) {
    console.error('Error adminResetPasswordManual:', err)
    return { ok: false, pesan: err.message || 'Terjadi kesalahan saat mengatur kata sandi baru.' }
  }

  revalidatePath('/admin/pengguna')
  return {
    ok: true,
    pesan: 'Kata sandi pengguna berhasil diatur ulang. Pengguna dapat langsung masuk dengan kata sandi baru tersebut.',
  }
}
