import { describe, expect, it } from 'vitest'
import {
  hitungKkalPerSendok,
  hitungFormulasiPKMK,
  PRODUK_PKMK_LIST,
  petakanProdukDbKeModel,
  type ProdukPKMK,
} from '@/lib/db/pkmk'
import { skemaProdukPKMKAdmin } from '@/lib/validasi/pkmk'

describe('Manajemen Master PKMK & Kalori Per Sendok (D-5 & S-2)', () => {
  describe('Perhitungan Kkal Per Sendok Takar Dinamis', () => {
    it('menghitung kalori per sendok SGM Gain 100 (100 kkal / 5 sendok = 20 kkal/sendok)', () => {
      const hasil = hitungKkalPerSendok(100, 5)
      expect(hasil).toBe(20.0)
    })

    it('menghitung kalori per sendok SGM Optigrow (160 kkal / 4 sendok = 40 kkal/sendok)', () => {
      const hasil = hitungKkalPerSendok(160, 4)
      expect(hasil).toBe(40.0)
    })

    it('menghitung kalori per sendok DanGro (180 kkal / 5 sendok = 36 kkal/sendok)', () => {
      const hasil = hitungKkalPerSendok(180, 5)
      expect(hasil).toBe(36.0)
    })

    it('menghitung kalori per sendok PediaComplete (200 kkal / 5 sendok = 40 kkal/sendok)', () => {
      const hasil = hitungKkalPerSendok(200, 5)
      expect(hasil).toBe(40.0)
    })

    it('menghitung kalori per sendok Nutrinidrink (300 kkal / 10 sendok = 30 kkal/sendok)', () => {
      const hasil = hitungKkalPerSendok(300, 10)
      expect(hasil).toBe(30.0)
    })

    it('menghitung pembagian desimal dengan pembulatan 2 angka (100 kkal / 3 sendok = 33.33)', () => {
      const hasil = hitungKkalPerSendok(100, 3)
      expect(hasil).toBe(33.33)
    })

    it('mengembalikan 0 untuk sendok takar nol atau negatif untuk mencegah pembagian nol', () => {
      expect(hitungKkalPerSendok(100, 0)).toBe(0)
      expect(hitungKkalPerSendok(100, -2)).toBe(0)
    })
  })

  describe('Validasi Zod Input Produk PKMK oleh Admin', () => {
    it('menerima input lengkap produk susu PKMK baru yang valid', () => {
      const input = {
        nama: 'Nutribaby Royal Pepti',
        merek: 'Nutricia',
        kkalPerSaji: 150,
        sendokPerSaji: 5,
        densitasKkalPerMl: 1.0,
        mlAirPerSendok: 30,
        mlPerSaji: 150,
        minUsiaBulan: 0,
        maksUsiaBulan: 12,
        proteinGPer100ml: 2.6,
        gramPerSendokTakar: 9.0,
        anjuranKlinis: 'Untuk indikasi alergi protein susu sapi di bawah supervisi dokter.',
        isActive: true,
      }

      const hasil = skemaProdukPKMKAdmin.safeParse(input)
      expect(hasil.success).toBe(true)
      if (hasil.success) {
        expect(hasil.data.nama).toBe('Nutribaby Royal Pepti')
        expect(hasil.data.sendokPerSaji).toBe(5)
        expect(hasil.data.kkalPerSaji).toBe(150)
      }
    })

    it('menolak jika sendok per saji bernilai nol', () => {
      const input = {
        nama: 'Susu Formula X',
        merek: 'Produsen Y',
        kkalPerSaji: 100,
        sendokPerSaji: 0,
      }
      const hasil = skemaProdukPKMKAdmin.safeParse(input)
      expect(hasil.success).toBe(false)
    })

    it('menolak jika kalori per saji bernilai negatif atau nol', () => {
      const input = {
        nama: 'Susu Formula X',
        merek: 'Produsen Y',
        kkalPerSaji: 0,
        sendokPerSaji: 4,
      }
      const hasil = skemaProdukPKMKAdmin.safeParse(input)
      expect(hasil.success).toBe(false)
    })

    it('menolak jika nama produk kosong atau kurang dari 2 karakter', () => {
      const input = {
        nama: 'A',
        merek: 'Produsen',
        kkalPerSaji: 150,
        sendokPerSaji: 4,
      }
      const hasil = skemaProdukPKMKAdmin.safeParse(input)
      expect(hasil.success).toBe(false)
    })

    it('memberikan nilai default untuk parameter densitas, takaran air, dan usia', () => {
      const input = {
        nama: 'Formula Medis Standar',
        merek: 'Farmasi Medika',
        kkalPerSaji: 160,
        sendokPerSaji: 4,
      }
      const hasil = skemaProdukPKMKAdmin.safeParse(input)
      expect(hasil.success).toBe(true)
      if (hasil.success) {
        expect(hasil.data.densitasKkalPerMl).toBe(1.0)
        expect(hasil.data.mlAirPerSendok).toBe(30)
        expect(hasil.data.minUsiaBulan).toBe(12)
        expect(hasil.data.isActive).toBe(true)
      }
    })
  })

  describe('Formulasi Resep Menggunakan Data Master PKMK Dinamis', () => {
    it('menghitung resep PKMK presisi untuk produk densitas standar', () => {
      const sgmGain = PRODUK_PKMK_LIST.find((p) => p.nama === 'SGM Gain 100')!
      // SGM Gain: kkalPerSendok = 20, densitas = 1.0, mlLarutanPerSendok = 18 (90 ml / 5 sdk)
      // Target: 400 kkal tambahan / hari, 4 kali saji
      const resep = hitungFormulasiPKMK(sgmGain, 400, 4)

      expect(resep.totalSendokHarian).toBe(20) // 400 / 20
      expect(resep.sendokPerPorsi).toBe(5) // 20 / 4
      expect(resep.mlAirPerPorsi).toBe(90) // 5 * 18 ml
      expect(resep.volumeHarianMl).toBe(360) // 400 / (100/90)
    })

    it('menghitung resep PKMK presisi untuk produk padat energi (Nutrinidrink)', () => {
      const nutrinidrink = PRODUK_PKMK_LIST.find((p) => p.nama === 'Nutrinidrink')!
      // Nutrinidrink: kkalPerSendok = 30, densitas = 300/150 = 2.0, mlLarutanPerSendok = 15 (150 ml / 10 sdk)
      // Target: 300 kkal tambahan / hari, 2 kali saji
      const resep = hitungFormulasiPKMK(nutrinidrink, 300, 2)

      expect(resep.totalSendokHarian).toBe(10) // 300 / 30
      expect(resep.sendokPerPorsi).toBe(5) // 10 / 2
      expect(resep.mlAirPerPorsi).toBe(75) // 5 * 15 ml
      expect(resep.volumeHarianMl).toBe(150) // 300 / (300/150)
    })
  })

  describe('Pemetaan Data Baris Supabase ke Model TypeScript', () => {
    it('memetakan baris database snake_case ke camelCase dengan benar', () => {
      const row = {
        id: 'uuid-123',
        nama: 'SGM Gain 100',
        merek: 'SGM',
        kkal_per_saji: 100,
        sendok_per_saji: 5,
        densitas_kkal_per_ml: 1.0,
        kkal_per_ml: 1.0,
        ml_air_per_sendok: 30,
        ml_per_saji: 90,
        min_usia_bulan: 12,
        maks_usia_bulan: 60,
        protein_g_per_100ml: 2.5,
        gram_per_sendok_takar: 9.0,
        anjuran_klinis: 'Aturan pakai khusus',
        is_active: true,
        created_at: '2026-09-07T12:00:00Z',
      }

      const model = petakanProdukDbKeModel(row)
      expect(model.id).toBe('uuid-123')
      expect(model.nama).toBe('SGM Gain 100')
      expect(model.kkalPerSendok).toBe(20)
      expect(model.sendokPerSaji).toBe(5)
      expect(model.densitasKkalPerMl).toBe(1.0)
      expect(model.isActive).toBe(true)
    })
  })
})
