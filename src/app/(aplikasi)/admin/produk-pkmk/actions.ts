'use server'

/**
 * Tindakan Server untuk Manajemen Produk PKMK oleh Administrator:
 * - Tambah produk susu PKMK baru beserta spesifikasi kkal dan sendok takar
 * - Edit spesifikasi nutrisi dan anjuran klinis produk PKMK
 * - Aktifkan / Nonaktifkan produk dari formulasi resep dietisien
 * - Hapus produk PKMK (dengan proteksi integritas riwayat asuhan gizi)
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { wajibPeran, TidakBerwenangError } from '@/lib/supabase/penjaga'
import { skemaProdukPKMKAdmin } from '@/lib/validasi/pkmk'

export type HasilTindakanPKMK = {
  ok: boolean
  pesan: string
  id?: string
}

export async function adminTambahProdukPKMK(formData: FormData): Promise<HasilTindakanPKMK> {
  try {
    await wajibPeran(['admin'])
  } catch (galat) {
    if (galat instanceof TidakBerwenangError) return { ok: false, pesan: galat.message }
    throw galat
  }

  const raw = {
    nama: formData.get('nama'),
    merek: formData.get('merek'),
    kkalPerSaji: formData.get('kkalPerSaji'),
    sendokPerSaji: formData.get('sendokPerSaji'),
    densitasKkalPerMl: formData.get('densitasKkalPerMl') || 1.0,
    mlAirPerSendok: formData.get('mlAirPerSendok') || 30,
    mlPerSaji: formData.get('mlPerSaji') || 180,
    minUsiaBulan: formData.get('minUsiaBulan') || 12,
    maksUsiaBulan: formData.get('maksUsiaBulan') ? formData.get('maksUsiaBulan') : null,
    proteinGPer100ml: formData.get('proteinGPer100ml') ? formData.get('proteinGPer100ml') : null,
    gramPerSendokTakar: formData.get('gramPerSendokTakar') ? formData.get('gramPerSendokTakar') : null,
    anjuranKlinis: formData.get('anjuranKlinis') || 'Periksa label kemasan untuk indikasi usia dan cara penyiapan.',
    isActive: formData.get('isActive') === 'false' ? false : true,
  }

  const hasilValidasi = skemaProdukPKMKAdmin.safeParse(raw)

  if (!hasilValidasi.success) {
    return {
      ok: false,
      pesan: hasilValidasi.error.issues[0]?.message ?? 'Data produk PKMK tidak valid.',
    }
  }

  const d = hasilValidasi.data
  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .from('produk_pkmk')
      .insert({
        nama: d.nama,
        merek: d.merek,
        kkal_per_saji: d.kkalPerSaji,
        sendok_per_saji: d.sendokPerSaji,
        densitas_kkal_per_ml: d.densitasKkalPerMl,
        kkal_per_ml: d.densitasKkalPerMl,
        ml_air_per_sendok: d.mlAirPerSendok,
        ml_per_saji: d.mlPerSaji,
        min_usia_bulan: d.minUsiaBulan,
        maks_usia_bulan: d.maksUsiaBulan ?? null,
        protein_g_per_100ml: d.proteinGPer100ml ?? null,
        gram_per_sendok_takar: d.gramPerSendokTakar ?? null,
        anjuran_klinis: d.anjuranKlinis,
        is_active: d.isActive,
      })
      .select('id')
      .single()

    if (error) {
      console.warn('Gagal insert produk_pkmk oleh admin:', error)
      return { ok: false, pesan: `Gagal menambahkan produk: ${error.message}` }
    }

    revalidatePath('/admin/produk-pkmk')
    revalidatePath('/dietisien')

    return {
      ok: true,
      pesan: `Produk susu PKMK "${d.nama}" berhasil ditambahkan ke master data.`,
      id: data?.id,
    }
  } catch (err: any) {
    console.error('Error adminTambahProdukPKMK:', err)
    return { ok: false, pesan: err.message || 'Terjadi kesalahan sistem saat menyimpan produk.' }
  }
}

export async function adminEditProdukPKMK(formData: FormData): Promise<HasilTindakanPKMK> {
  try {
    await wajibPeran(['admin'])
  } catch (galat) {
    if (galat instanceof TidakBerwenangError) return { ok: false, pesan: galat.message }
    throw galat
  }

  const id = formData.get('id') as string
  if (!id) {
    return { ok: false, pesan: 'ID produk tidak ditemukan.' }
  }

  const raw = {
    id,
    nama: formData.get('nama'),
    merek: formData.get('merek'),
    kkalPerSaji: formData.get('kkalPerSaji'),
    sendokPerSaji: formData.get('sendokPerSaji'),
    densitasKkalPerMl: formData.get('densitasKkalPerMl') || 1.0,
    mlAirPerSendok: formData.get('mlAirPerSendok') || 30,
    mlPerSaji: formData.get('mlPerSaji') || 180,
    minUsiaBulan: formData.get('minUsiaBulan') || 12,
    maksUsiaBulan: formData.get('maksUsiaBulan') ? formData.get('maksUsiaBulan') : null,
    proteinGPer100ml: formData.get('proteinGPer100ml') ? formData.get('proteinGPer100ml') : null,
    gramPerSendokTakar: formData.get('gramPerSendokTakar') ? formData.get('gramPerSendokTakar') : null,
    anjuranKlinis: formData.get('anjuranKlinis') || 'Periksa label kemasan untuk indikasi usia dan cara penyiapan.',
    isActive: formData.get('isActive') === 'false' ? false : true,
  }

  const hasilValidasi = skemaProdukPKMKAdmin.safeParse(raw)

  if (!hasilValidasi.success) {
    return {
      ok: false,
      pesan: hasilValidasi.error.issues[0]?.message ?? 'Data produk PKMK tidak valid.',
    }
  }

  const d = hasilValidasi.data
  const supabase = await createClient()

  try {
    const { error } = await supabase
      .from('produk_pkmk')
      .update({
        nama: d.nama,
        merek: d.merek,
        kkal_per_saji: d.kkalPerSaji,
        sendok_per_saji: d.sendokPerSaji,
        densitas_kkal_per_ml: d.densitasKkalPerMl,
        kkal_per_ml: d.densitasKkalPerMl,
        ml_air_per_sendok: d.mlAirPerSendok,
        ml_per_saji: d.mlPerSaji,
        min_usia_bulan: d.minUsiaBulan,
        maks_usia_bulan: d.maksUsiaBulan ?? null,
        protein_g_per_100ml: d.proteinGPer100ml ?? null,
        gram_per_sendok_takar: d.gramPerSendokTakar ?? null,
        anjuran_klinis: d.anjuranKlinis,
        is_active: d.isActive,
      })
      .eq('id', id)

    if (error) {
      console.warn('Gagal update produk_pkmk oleh admin:', error)
      return { ok: false, pesan: `Gagal memperbarui produk: ${error.message}` }
    }

    revalidatePath('/admin/produk-pkmk')
    revalidatePath('/dietisien')

    return {
      ok: true,
      pesan: `Data produk susu PKMK "${d.nama}" berhasil diperbarui.`,
    }
  } catch (err: any) {
    console.error('Error adminEditProdukPKMK:', err)
    return { ok: false, pesan: err.message || 'Terjadi kesalahan sistem saat memperbarui produk.' }
  }
}

export async function adminToggleStatusPKMK(id: string, isActive: boolean): Promise<HasilTindakanPKMK> {
  try {
    await wajibPeran(['admin'])
  } catch (galat) {
    if (galat instanceof TidakBerwenangError) return { ok: false, pesan: galat.message }
    throw galat
  }

  const supabase = await createClient()

  try {
    const { error } = await supabase
      .from('produk_pkmk')
      .update({ is_active: isActive })
      .eq('id', id)

    if (error) {
      return { ok: false, pesan: `Gagal mengubah status: ${error.message}` }
    }

    revalidatePath('/admin/produk-pkmk')
    revalidatePath('/dietisien')

    return {
      ok: true,
      pesan: `Status produk berhasil diubah menjadi ${isActive ? 'Aktif' : 'Non-Aktif'}.`,
    }
  } catch (err: any) {
    return { ok: false, pesan: err.message || 'Terjadi kesalahan saat mengubah status produk.' }
  }
}

export async function adminHapusProdukPKMK(id: string): Promise<HasilTindakanPKMK> {
  try {
    await wajibPeran(['admin'])
  } catch (galat) {
    if (galat instanceof TidakBerwenangError) return { ok: false, pesan: galat.message }
    throw galat
  }

  const supabase = await createClient()

  try {
    // 1. Periksa integritas klinis: apakah produk ini sudah pernah diresepkan pada asuhan_gizi
    const { count, error: countError } = await supabase
      .from('asuhan_gizi')
      .select('id', { count: 'exact', head: true })
      .eq('produk_pkmk_id', id)

    if (!countError && count && count > 0) {
      return {
        ok: false,
        pesan: `Produk tidak dapat dihapus karena telah terhubung dengan ${count} rekam medis asuhan gizi. Silakan nonaktifkan status produk agar tidak muncul lagi pada resep baru.`,
      }
    }

    const { error } = await supabase
      .from('produk_pkmk')
      .delete()
      .eq('id', id)

    if (error) {
      return { ok: false, pesan: `Gagal menghapus produk: ${error.message}` }
    }

    revalidatePath('/admin/produk-pkmk')
    revalidatePath('/dietisien')

    return {
      ok: true,
      pesan: 'Produk susu PKMK berhasil dihapus dari master data.',
    }
  } catch (err: any) {
    return { ok: false, pesan: err.message || 'Terjadi kesalahan sistem saat menghapus produk.' }
  }
}
