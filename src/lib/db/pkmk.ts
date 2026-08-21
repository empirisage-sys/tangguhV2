/**
 * Master Data Produk PKMK (Pangan Olahan untuk Keperluan Medis Khusus)
 * Sesuai data tabel `produk_pkmk` pada migrasi Supabase.
 *
 * Nilai `kkal_per_sendok` dihitung secara dinamis dari (kkal_per_saji / sendok_per_saji),
 * BUKAN angka tetap 25 kkal/sendok seperti pada versi purwarupa lama.
 */

export type ProdukPKMK = {
  id: string
  nama: string
  merek: string
  kkalPerMl: number
  sendokPerSaji: number
  kkalPerSaji: number
  mlPerSaji: number
  mlAirPerSendok: number
  densitasKkalPerMl: number
  kkalPerSendok: number
  minUsiaBulan: number
  anjuranKlinis: string
}

export const PRODUK_PKMK_LIST: ProdukPKMK[] = [
  {
    id: 'pkmk-1',
    nama: 'SGM Gain 100',
    merek: 'SGM',
    kkalPerMl: 1.0,
    sendokPerSaji: 5,
    kkalPerSaji: 100,
    mlPerSaji: 90,
    mlAirPerSendok: 30,
    densitasKkalPerMl: 1.0,
    kkalPerSendok: 20.0, // 100 / 5
    minUsiaBulan: 12,
    anjuranKlinis: 'Periksa label kemasan untuk indikasi usia dan cara penyiapan.',
  },
  {
    id: 'pkmk-2',
    nama: 'SGM Optigrow',
    merek: 'SGM',
    kkalPerMl: 1.0,
    sendokPerSaji: 4,
    kkalPerSaji: 160,
    mlPerSaji: 180,
    mlAirPerSendok: 30,
    densitasKkalPerMl: 1.0,
    kkalPerSendok: 40.0, // 160 / 4
    minUsiaBulan: 12,
    anjuranKlinis: 'Periksa label kemasan untuk indikasi usia dan cara penyiapan.',
  },
  {
    id: 'pkmk-3',
    nama: 'DanGro Gain&Grow',
    merek: 'Danone',
    kkalPerMl: 1.0,
    sendokPerSaji: 5,
    kkalPerSaji: 180,
    mlPerSaji: 180,
    mlAirPerSendok: 30,
    densitasKkalPerMl: 1.0,
    kkalPerSendok: 36.0, // 180 / 5
    minUsiaBulan: 12,
    anjuranKlinis: 'Periksa label kemasan untuk indikasi usia dan cara penyiapan.',
  },
  {
    id: 'pkmk-4',
    nama: 'PediaComplete',
    merek: 'Kalbe',
    kkalPerMl: 1.0,
    sendokPerSaji: 5,
    kkalPerSaji: 200,
    mlPerSaji: 190,
    mlAirPerSendok: 38,
    densitasKkalPerMl: 1.0,
    kkalPerSendok: 40.0, // 200 / 5
    minUsiaBulan: 12,
    anjuranKlinis: 'Periksa label kemasan untuk indikasi usia dan cara penyiapan.',
  },
  {
    id: 'pkmk-5',
    nama: 'Nutrinidrink',
    merek: 'Nutricia',
    kkalPerMl: 1.5,
    sendokPerSaji: 10,
    kkalPerSaji: 300,
    mlPerSaji: 150,
    mlAirPerSendok: 30,
    densitasKkalPerMl: 1.5,
    kkalPerSendok: 30.0, // 300 / 10
    minUsiaBulan: 12,
    anjuranKlinis: 'Densitas 1,5 kkal/ml untuk kebutuhan kalori padat. Periksa label kemasan.',
  },
]

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
  const volumeHarianMl = Math.round(targetKaloriTambahanKkal / produk.densitasKkalPerMl)
  const totalSendokHarian = Math.round(targetKaloriTambahanKkal / produk.kkalPerSendok)
  const sendokPerPorsi = Math.max(1, Math.round(totalSendokHarian / jumlahSajian))
  const mlAirPerPorsi = Math.round(sendokPerPorsi * produk.mlAirPerSendok)

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
