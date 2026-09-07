import { describe, expect, it } from 'vitest'
import {
  hitungKkalPerSendok,
  PRODUK_PKMK_LIST,
  petakanProdukDbKeModel,
  petakanDaftarProdukDb,
  periksaKonsistensiProduk,
  type ProdukPKMK,
} from '@/lib/db/pkmk'
import { BATAS, hitungTakaran } from '@/lib/pkmk/hitung'
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

    it('mengembalikan null untuk sendok takar nol atau negatif, bukan 0', () => {
      // Angka 0 adalah jawaban yang salah dan menyesatkan: ia mengalir ke
      // perhitungan berikutnya sebagai "kkal per sendok = 0" dan pada versi
      // lama memicu cadangan `|| 25`, yaitu konstanta yang justru dilarang.
      // `null` memaksa pemanggil menangani baris yang tidak sah (T-6).
      expect(hitungKkalPerSendok(100, 0)).toBeNull()
      expect(hitungKkalPerSendok(100, -2)).toBeNull()
      expect(hitungKkalPerSendok(0, 5)).toBeNull()
      expect(hitungKkalPerSendok(null, 5)).toBeNull()
      expect(hitungKkalPerSendok(100, null)).toBeNull()
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
      // Angka dipilih agar SEJALAN satu dengan lainnya: 180 kkal / 180 ml = 1,0
      // kkal/ml, dan 6 sendok x 30 ml = 180 ml.
      const input = {
        nama: 'Formula Medis Standar',
        merek: 'Farmasi Medika',
        kkalPerSaji: 180,
        sendokPerSaji: 6,
      }
      const hasil = skemaProdukPKMKAdmin.safeParse(input)
      expect(hasil.success).toBe(true)
      if (hasil.success) {
        expect(hasil.data.densitasKkalPerMl).toBe(1.0)
        expect(hasil.data.mlAirPerSendok).toBe(30)
        expect(hasil.data.mlPerSaji).toBe(180)
        expect(hasil.data.minUsiaBulan).toBe(12)
        expect(hasil.data.isActive).toBe(true)
      }
    })

    // ======================================================================
    // Pemeriksaan lintas medan (temuan audit T-3 & T-9)
    // ======================================================================
    it('menolak densitas yang bertentangan dengan kkal per saji dibagi volume per saji', () => {
      // Nutrinidrink pada data seed: 300 kkal / 150 ml = 2,00 kkal/ml,
      // tetapi kolom densitasnya tersimpan 1,50 — selisih 25%.
      const hasil = skemaProdukPKMKAdmin.safeParse({
        nama: 'Nutrinidrink',
        merek: 'Nutricia',
        kkalPerSaji: 300,
        sendokPerSaji: 10,
        mlPerSaji: 150,
        mlAirPerSendok: 15,
        densitasKkalPerMl: 1.5,
      })
      expect(hasil.success).toBe(false)
      if (!hasil.success) {
        expect(hasil.error.issues.some((i) => i.path.includes('densitasKkalPerMl'))).toBe(true)
      }
    })

    it('menolak volume per saji yang bertentangan dengan sendok kali air per sendok', () => {
      // 10 sendok x 30 ml = 300 ml, tetapi volume per saji diisi 150 ml.
      const hasil = skemaProdukPKMKAdmin.safeParse({
        nama: 'Nutrinidrink',
        merek: 'Nutricia',
        kkalPerSaji: 300,
        sendokPerSaji: 10,
        mlPerSaji: 150,
        mlAirPerSendok: 30,
        densitasKkalPerMl: 2.0,
      })
      expect(hasil.success).toBe(false)
      if (!hasil.success) {
        expect(hasil.error.issues.some((i) => i.path.includes('mlAirPerSendok'))).toBe(true)
      }
    })

    it('menolak usia maksimal yang mendahului usia minimal', () => {
      const hasil = skemaProdukPKMKAdmin.safeParse({
        nama: 'Formula Uji',
        merek: 'Uji',
        kkalPerSaji: 180,
        sendokPerSaji: 6,
        minUsiaBulan: 24,
        maksUsiaBulan: 12,
      })
      expect(hasil.success).toBe(false)
      if (!hasil.success) {
        expect(hasil.error.issues.some((i) => i.path.includes('maksUsiaBulan'))).toBe(true)
      }
    })

    it('menerima produk yang seluruh angkanya sejalan', () => {
      const hasil = skemaProdukPKMKAdmin.safeParse({
        nama: 'PediaComplete',
        merek: 'Kalbe',
        kkalPerSaji: 200,
        sendokPerSaji: 5,
        mlPerSaji: 190,
        mlAirPerSendok: 38,
        densitasKkalPerMl: 1.05,
        minUsiaBulan: 12,
        maksUsiaBulan: 60,
      })
      expect(hasil.success).toBe(true)
    })
  })

  describe('Takaran PKMK: energi selalu diturunkan dari takaran akhir (T-1 & T-2)', () => {
    it('menghitung takaran memakai hitungTakaran, dan energinya konsisten dengan sendok', () => {
      const sgmGain = PRODUK_PKMK_LIST.find((p) => p.nama === 'SGM Gain 100')!
      const hasil = hitungTakaran({
        produk: sgmGain,
        mode: 'dari_target',
        frekuensiPerHari: 4,
        targetKkal: 400,
      })

      expect(hasil.sendokPerSaji).toBe(5) // 400 / (4 x 20) = 5
      expect(hasil.sendokPerHari).toBe(20)
      expect(hasil.kkalDiberikan).toBe(400)
      // Volume larutan hanya berasal dari SATU jalur: sendok x ml larutan/sendok.
      expect(hasil.mlLarutanPerSaji).toBe(90) // 5 sdk x 18 ml
      expect(hasil.mlLarutanPerHari).toBe(360)
    })

    // ======================================================================
    // UJI INVARIAN
    //
    // Inilah uji yang tidak ada sebelumnya. Suite lama memeriksa jumlah sendok
    // dan volume, tetapi TIDAK PERNAH satu kali pun memeriksa energi yang
    // benar-benar diberikan — padahal itulah angka yang menentukan apa yang
    // diminum anak. Karena itu suite lama tetap hijau meski 23% kombinasi
    // menyimpang lebih dari 10% dari target. Lihat temuan audit T-1 dan T-13.
    // ======================================================================
    it('energi diberikan SELALU sama dengan sendokPerHari x kkalPerSendok, tanpa kecuali', () => {
      for (const produk of PRODUK_PKMK_LIST) {
        for (let target = 50; target <= 1000; target += 50) {
          for (let f = BATAS.frekuensiMin; f <= BATAS.frekuensiMaks; f++) {
            const h = hitungTakaran({ produk, mode: 'dari_target', frekuensiPerHari: f, targetKkal: target })
            const konteks = `${produk.nama} target ${target} kkal ${f}x`

            // Invarian inti: tidak ada jalan lain menuju angka energi.
            expect(h.kkalDiberikan, konteks).toBeCloseTo(h.sendokPerHari * h.kkalPerSendok, 6)

            // Volume juga hanya satu jalur.
            expect(h.mlLarutanPerSaji, konteks).toBeCloseTo(
              h.sendokPerSaji * h.mlLarutanPerSendok,
              1,
            )
            expect(h.mlLarutanPerHari, konteks).toBeCloseTo(
              h.mlLarutanPerSaji * h.frekuensiPerHari,
              1,
            )
          }
        }
      }
    })

    it('setiap penyimpangan di luar toleransi WAJIB memunculkan peringatan', () => {
      let diperiksa = 0
      for (const produk of PRODUK_PKMK_LIST) {
        for (let target = 50; target <= 1000; target += 50) {
          for (let f = BATAS.frekuensiMin; f <= BATAS.frekuensiMaks; f++) {
            const h = hitungTakaran({ produk, mode: 'dari_target', frekuensiPerHari: f, targetKkal: target })
            const selisihPersen = Math.abs((h.selisihKkal / target) * 100)
            if (selisihPersen > BATAS.toleransiPersen) {
              diperiksa += 1
              const adaPeringatanTarget = h.peringatan.some(
                (p) => p.kode === 'kurang_dari_target' || p.kode === 'lebih_dari_target',
              )
              expect(
                adaPeringatanTarget,
                `${produk.nama} target ${target} kkal ${f}x menyimpang ${selisihPersen.toFixed(0)}% tanpa peringatan`,
              ).toBe(true)
            }
          }
        }
      }
      // Memastikan uji ini benar-benar menemui kasus menyimpang, bukan lulus kosong.
      expect(diperiksa).toBeGreaterThan(0)
    })

    it('volume per saji di atas batas wajar balita selalu diperingatkan', () => {
      const nutrinidrink = PRODUK_PKMK_LIST.find((p) => p.nama === 'Nutrinidrink')!
      for (const produk of PRODUK_PKMK_LIST) {
        for (let f = 1; f <= BATAS.frekuensiMaks; f++) {
          const h = hitungTakaran({ produk, mode: 'dari_target', frekuensiPerHari: f, targetKkal: 1000 })
          if (h.mlLarutanPerSaji > BATAS.mlPerSajiWajarMaks) {
            expect(h.peringatan.some((p) => p.kode === 'volume_per_saji_berlebih')).toBe(true)
          }
        }
      }
      expect(nutrinidrink.kkalPerSendok).toBe(30)
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

      const model = petakanProdukDbKeModel(row)!
      expect(model).not.toBeNull()
      expect(model.id).toBe('uuid-123')
      expect(model.nama).toBe('SGM Gain 100')
      expect(model.kkalPerSendok).toBe(20)
      expect(model.sendokPerSaji).toBe(5)
      // Densitas kini DITURUNKAN dari label (100 kkal / 90 ml = 1,11),
      // bukan dibaca dari kolom densitas_kkal_per_ml yang berisi 1,00 (T-3).
      expect(model.densitasKkalPerMl).toBeCloseTo(100 / 90, 6)
      // Volume larutan per sendok juga turunan, bukan ml_air_per_sendok.
      expect(model.mlLarutanPerSendok).toBeCloseTo(18, 6)
      expect(model.mlAirPerSendok).toBe(30)
      expect(model.isActive).toBe(true)
    })

    // ======================================================================
    // Baris rusak ditolak, bukan ditebak (temuan audit T-6 & T-8)
    // ======================================================================
    it('menolak baris tanpa sendok_per_saji alih-alih menebak 1 sendok', () => {
      // Pola lama `Number(x) || 1` membuat Nutrinidrink 300 kkal per saji
      // terbaca 300 kkal PER SENDOK: sepuluh kali lipat, tanpa peringatan.
      const model = petakanProdukDbKeModel({
        id: 'uuid-rusak',
        nama: 'Nutrinidrink',
        kkal_per_saji: 300,
        sendok_per_saji: null,
        ml_per_saji: 150,
      })
      expect(model).toBeNull()
    })

    it('menolak baris tanpa kkal_per_saji', () => {
      expect(
        petakanProdukDbKeModel({ id: 'x', nama: 'Tanpa Kalori', sendok_per_saji: 5, ml_per_saji: 180 }),
      ).toBeNull()
    })

    it('min_usia_bulan yang kosong menjadi 12, bukan NaN', () => {
      // `?? 12` pada versi lama tidak pernah menangkap NaN, sehingga
      // "≥ NaN bln" bisa lolos ke tampilan dan produk hilang dari peresepan.
      const model = petakanProdukDbKeModel({
        id: 'uuid-1',
        nama: 'Uji',
        kkal_per_saji: 180,
        sendok_per_saji: 5,
        ml_per_saji: 180,
      })!
      expect(Number.isNaN(model.minUsiaBulan)).toBe(false)
      expect(model.minUsiaBulan).toBe(12)
    })

    it('min_usia_bulan bernilai 0 tetap dibaca 0, tidak dianggap kosong', () => {
      const model = petakanProdukDbKeModel({
        id: 'uuid-2',
        nama: 'Uji Nol',
        kkal_per_saji: 180,
        sendok_per_saji: 5,
        ml_per_saji: 180,
        min_usia_bulan: 0,
      })!
      expect(model.minUsiaBulan).toBe(0)
    })

    it('memetakan daftar dan melaporkan jumlah baris yang ditolak', () => {
      const { produk, jumlahDitolak } = petakanDaftarProdukDb([
        { id: 'a', nama: 'Sah', kkal_per_saji: 180, sendok_per_saji: 5, ml_per_saji: 180 },
        { id: 'b', nama: 'Rusak', kkal_per_saji: 180, sendok_per_saji: null, ml_per_saji: 180 },
        null,
      ])
      expect(produk).toHaveLength(1)
      expect(jumlahDitolak).toBe(2)
    })
  })

  describe('Laporan konsistensi kolom simpanan terhadap label (T-3)', () => {
    it('menandai densitas Nutrinidrink pada data seed sebagai menyimpang', () => {
      const selisih = periksaKonsistensiProduk({
        kkal_per_saji: 300,
        sendok_per_saji: 10,
        ml_per_saji: 150,
        ml_air_per_sendok: 30,
        densitas_kkal_per_ml: 1.5,
      })
      const densitas = selisih.find((x) => x.medan === 'densitas')!
      expect(densitas).toBeDefined()
      expect(densitas.nilaiLabel).toBeCloseTo(2.0, 2)
      expect(densitas.selisihPersen).toBeCloseTo(-25, 0)

      const volume = selisih.find((x) => x.medan === 'volume_saji')!
      expect(volume).toBeDefined()
      expect(volume.nilaiTersimpan).toBe(300)
      expect(volume.nilaiLabel).toBe(150)
    })

    it('tidak menandai produk yang angkanya sudah sejalan', () => {
      const selisih = periksaKonsistensiProduk({
        kkal_per_saji: 200,
        sendok_per_saji: 5,
        ml_per_saji: 190,
        ml_air_per_sendok: 38,
        densitas_kkal_per_ml: 1.05,
      })
      expect(selisih).toHaveLength(0)
    })
  })
})
