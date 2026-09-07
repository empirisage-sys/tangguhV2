/**
 * Adaptor Master Data PKMK untuk Kompatibilitas Database & Modul Admin.
 *
 * Mengarahkan dan menghubungkan data produk ke `src/lib/pkmk/`.
 * Mendukung pembacaan baris tabel Supabase `produk_pkmk` serta perhitungan kkal.
 */

import {
  PRODUK_PKMK,
  type ProdukPKMK as ProdukPKMKCore,
  type LabelProdukPKMK,
  produkById,
  produkUntukUmur,
  PERINGATAN_DATA_PRODUK,
} from '@/lib/pkmk/produk'

export type ProdukPKMK = ProdukPKMKCore & {
  mlPerSaji?: number
  mlAirPerSendok?: number
  kkalPerMl?: number
  anjuranKlinis?: string
  isActive?: boolean
  proteinGPer100ml?: number | null
  gramPerSendokTakar?: number | null
  maksUsiaBulan?: number | null
  createdAt?: string
}

export const PRODUK_PKMK_LIST: ProdukPKMK[] = PRODUK_PKMK as ProdukPKMK[]
export { produkById, produkUntukUmur, PERINGATAN_DATA_PRODUK }

/**
 * Menghitung kkal per sendok takar dari kalori per saji dan jumlah sendok.
 */
export function hitungKkalPerSendok(kkalPerSaji: number, sendokPerSaji: number): number {
  if (!sendokPerSaji || sendokPerSaji <= 0) return 0
  return Number((kkalPerSaji / sendokPerSaji).toFixed(2))
}

/**
 * Pemetaan baris dari database Supabase (snake_case) ke tipe ProdukPKMK (camelCase).
 */
export function petakanProdukDbKeModel(row: any): ProdukPKMK {
  const kkalPerSaji = Number(row.kkal_per_saji) || 0
  const sendokPerSaji = Number(row.sendok_per_saji) || 1
  const mlLarutanPerSaji = Number(row.ml_per_saji) || Number(row.ml_larutan_per_saji) || 180
  const kkalPerSendok = Number(row.kkal_per_sendok) || hitungKkalPerSendok(kkalPerSaji, sendokPerSaji)
  const mlLarutanPerSendok = Number(row.ml_air_per_sendok) || (sendokPerSaji > 0 ? mlLarutanPerSaji / sendokPerSaji : 30)
  const densitasKkalPerMl =
    Number(row.densitas_kkal_per_ml) ||
    Number(row.kkal_per_ml) ||
    (mlLarutanPerSaji > 0 ? kkalPerSaji / mlLarutanPerSaji : 1.0)
  const catatan = row.anjuran_klinis || row.catatan_klinis || 'Periksa label kemasan untuk indikasi usia dan cara penyiapan.'

  return {
    id: row.id,
    nama: row.nama,
    merek: row.merek || '',
    sendokPerSaji,
    kkalPerSaji,
    mlLarutanPerSaji,
    mlPerSaji: mlLarutanPerSaji,
    minUsiaBulan: Number(row.min_usia_bulan) ?? 12,
    maksUsiaBulan: row.maks_usia_bulan != null ? Number(row.maks_usia_bulan) : null,
    catatanKlinis: catatan,
    anjuranKlinis: catatan,
    kkalPerSendok,
    mlLarutanPerSendok,
    mlAirPerSendok: mlLarutanPerSendok,
    densitasKkalPerMl,
    kkalPerMl: densitasKkalPerMl,
    proteinGPer100ml: row.protein_g_per_100ml != null ? Number(row.protein_g_per_100ml) : null,
    gramPerSendokTakar: row.gram_per_sendok_takar != null ? Number(row.gram_per_sendok_takar) : null,
    isActive: row.is_active ?? true,
    createdAt: row.created_at,
  }
}

export type ResepFormulasiPKMK = {
  produk: ProdukPKMK
  targetKaloriPKMKKkal: number
  volumeHarianMl: number
  jumlahSajian: number
  sendokPerPorsi: number
  mlAirPerPorsi: number
  totalSendokHarian: number
}

/**
 * Menghitung formulasi takaran praktis PKMK harian.
 */
export function hitungFormulasiPKMK(
  produk: ProdukPKMK,
  targetKaloriTambahanKkal: number,
  jumlahSajian: number = 3,
): ResepFormulasiPKMK {
  const densitas = produk.densitasKkalPerMl || 1.0
  const kkalSendok = produk.kkalPerSendok || hitungKkalPerSendok(produk.kkalPerSaji, produk.sendokPerSaji) || 25
  const volumeHarianMl = Math.round(targetKaloriTambahanKkal / densitas)
  const totalSendokHarian = Math.round(targetKaloriTambahanKkal / kkalSendok)
  const sendokPerPorsi = Math.max(1, Math.round(totalSendokHarian / (jumlahSajian || 3)))
  const mlAirPerPorsi = Math.round(sendokPerPorsi * (produk.mlAirPerSendok || produk.mlLarutanPerSendok || 30))

  return {
    produk,
    targetKaloriPKMKKkal: targetKaloriTambahanKkal,
    volumeHarianMl,
    jumlahSajian,
    sendokPerPorsi,
    mlAirPerPorsi,
    totalSendokHarian,
  }
}
