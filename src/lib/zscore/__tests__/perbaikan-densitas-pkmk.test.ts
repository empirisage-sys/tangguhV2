/**
 * Uji pengunci T-11 dan T-12: air tuang bukan larutan jadi.
 *
 * Ditemukan Pak Nelitie saat menyunting produk di halaman admin PKMK.
 * Menyimpan SGM Gain Optigrow dengan angka label yang BENAR ditolak:
 *
 *   Densitas 1 kkal/ml bertentangan dengan label produk ini:
 *   213 kkal / 180 ml = 1,18 kkal/ml (selisih 15%).
 *
 * Padahal 1,0 kkal/ml justru benar. Densitas klinis dihitung terhadap volume
 * LARUTAN JADI (210 ml), bukan air yang dituang (180 ml): 213 / 210 = 1,01.
 *
 * Rantai sebabnya dua langkah, dan langkah pertamalah yang rusak:
 *
 *   1. Pemeriksaan volume lama menuntut sendok x air per sendok ~ volume per
 *      saji dalam 10%. Tuntutan itu keliru secara fisik — bubuk menempati
 *      ruang. Label yang benar (180 ml air, 210 ml larutan) ditolak.
 *   2. Demi lolos, medan "volume per saji" terpaksa diisi volume AIR. Barulah
 *      pemeriksaan densitas — yang rumusnya SUDAH benar — membagi dengan
 *      angka yang salah dan menuduh densitas yang benar.
 *
 * Data benih tidak pernah menyingkapkannya: `turunkan()` di produk.ts
 * menetapkan air per sendok = larutan per sendok, sehingga kesamaan itu benar
 * menurut definisi dan pemeriksaannya selalu lolos.
 */
import { describe, expect, it } from 'vitest'
import { skemaProdukPKMKAdmin } from '@/lib/validasi/pkmk'

/** Angka label SGM Gain Optigrow sebagaimana dibaca Pak Nelitie. */
const OPTIGROW = {
  nama: 'SGM Gain Optigrow',
  merek: 'SGM',
  kkalPerSaji: 213,
  sendokPerSaji: 4,
  mlAirPerSendok: 45, // 4 x 45 = 180 ml air
  mlPerSaji: 210, // larutan jadi menurut label
  densitasKkalPerMl: 1.0, // 213 / 210 = 1,014
  minUsiaBulan: 12,
}

describe('T-11 label yang benar tidak lagi ditolak', () => {
  it('SGM Gain Optigrow tersimpan dengan angka label apa adanya', () => {
    const hasil = skemaProdukPKMKAdmin.safeParse(OPTIGROW)
    if (!hasil.success) {
      throw new Error(
        'Label yang benar masih ditolak: ' + hasil.error.issues.map((i) => i.message).join(' | '),
      )
    }
    expect(hasil.success).toBe(true)
  })

  it('densitas dihitung terhadap larutan jadi, bukan air', () => {
    // Inilah selisih yang dahulu menghasilkan tuduhan 15%.
    expect(OPTIGROW.kkalPerSaji / OPTIGROW.mlPerSaji).toBeCloseTo(1.014, 3)
    expect(OPTIGROW.kkalPerSaji / 180).toBeCloseTo(1.183, 3)

    // Densitas yang BENAR diterima; yang diturunkan dari air ditolak.
    expect(skemaProdukPKMKAdmin.safeParse(OPTIGROW).success).toBe(true)
    expect(
      skemaProdukPKMKAdmin.safeParse({ ...OPTIGROW, densitasKkalPerMl: 1.18 }).success,
    ).toBe(false)
  })

  it('bentuk lama akan menolaknya, dan itulah yang uji ini cegah', () => {
    // Aturan lama: |sendok x air - volume saji| / volume saji <= 10%.
    const airTotal = OPTIGROW.sendokPerSaji * OPTIGROW.mlAirPerSendok
    const selisihLama = Math.abs(airTotal - OPTIGROW.mlPerSaji) / OPTIGROW.mlPerSaji
    expect(selisihLama).toBeGreaterThan(0.1)

    // Namun sekarang produk yang sama diterima.
    expect(skemaProdukPKMKAdmin.safeParse(OPTIGROW).success).toBe(true)
  })
})

describe('T-11 yang tetap ditolak adalah yang memang mustahil', () => {
  it('air tidak boleh melebihi larutan jadi', () => {
    const hasil = skemaProdukPKMKAdmin.safeParse({
      ...OPTIGROW,
      mlAirPerSendok: 60, // 4 x 60 = 240 ml air untuk larutan 210 ml
      mlPerSaji: 210,
    })
    expect(hasil.success).toBe(false)
    if (!hasil.success) {
      expect(hasil.error.issues.some((i) => i.path.includes('mlPerSaji'))).toBe(true)
    }
  })

  it('pembulatan label beberapa ml tidak dianggap kesalahan', () => {
    // 4 x 45 = 180 ml air, larutan jadi dibulatkan ke 178 ml. Selisih 1,1%,
    // masih di dalam kelonggaran pembulatan.
    const hasil = skemaProdukPKMKAdmin.safeParse({
      ...OPTIGROW,
      mlPerSaji: 178,
      densitasKkalPerMl: 213 / 178,
    })
    expect(hasil.success).toBe(true)
  })

  it('ruang bubuk yang tidak masuk akal tetap tertangkap', () => {
    // 4 sendok, 40 ml air (160 ml), larutan jadi diketik 800 ml.
    // Sisa 640 ml untuk 4 sendok bubuk = 160 ml per sendok. Mustahil.
    const hasil = skemaProdukPKMKAdmin.safeParse({
      ...OPTIGROW,
      mlAirPerSendok: 40,
      mlPerSaji: 800,
      densitasKkalPerMl: 213 / 800,
    })
    expect(hasil.success).toBe(false)
    if (!hasil.success) {
      expect(hasil.error.issues.some((i) => i.message.includes('per sendok takar'))).toBe(true)
    }
  })
})

describe('T-11 produk padat kalori nyata tidak terhalang', () => {
  it('produk dengan kkal per sendok jauh di atas 40 tetap tersimpan', () => {
    // 53,25 kkal per sendok — di luar kalimat spanduk lama "20 hingga 40",
    // tetapi tidak pernah ada satu pun aturan yang menegakkannya.
    expect(OPTIGROW.kkalPerSaji / OPTIGROW.sendokPerSaji).toBeCloseTo(53.25, 2)
    expect(skemaProdukPKMKAdmin.safeParse(OPTIGROW).success).toBe(true)
  })

  it('DanGro 213 kkal per 5 sendok juga tersimpan', () => {
    const hasil = skemaProdukPKMKAdmin.safeParse({
      nama: 'DanGro Gain&Grow',
      merek: 'Danone',
      kkalPerSaji: 213,
      sendokPerSaji: 5,
      mlAirPerSendok: 36, // 180 ml air
      mlPerSaji: 210,
      densitasKkalPerMl: 213 / 210,
      minUsiaBulan: 12,
    })
    expect(hasil.success).toBe(true)
  })
})

describe('T-11 pemeriksaan densitas tetap menjaga dari sisi server', () => {
  it('densitas yang benar-benar bertentangan masih ditolak', () => {
    // Layar admin kini menurunkan densitas sendiri, tetapi FormData dapat
    // disusun tangan tanpa melewatinya. Jaring ini wajib tetap ada.
    const hasil = skemaProdukPKMKAdmin.safeParse({
      ...OPTIGROW,
      densitasKkalPerMl: 2.5, // 213 / 210 = 1,01
    })
    expect(hasil.success).toBe(false)
    if (!hasil.success) {
      expect(hasil.error.issues.some((i) => i.path.includes('densitasKkalPerMl'))).toBe(true)
    }
  })
})
