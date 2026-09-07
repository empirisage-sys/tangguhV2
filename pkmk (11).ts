import { z } from 'zod'

/**
 * Skema validasi produk PKMK (Pangan Olahan untuk Keperluan Medis Khusus)
 * Digunakan pada form penambahan dan pengubahan produk oleh Administrator.
 *
 * Catatan Klinis (D-5 & S-2):
 * `kkal_per_sendok` dihitung otomatis dari (kkal_per_saji / sendok_per_saji).
 * Nilai sendok_per_saji wajib > 0 agar tidak terjadi pembagian dengan nol.
 *
 * PEMERIKSAAN LINTAS MEDAN (temuan audit T-3 dan T-9)
 * Versi sebelumnya tidak memiliki satu pun `refine`, sehingga lima medan
 * saling bertentangan dapat tersimpan bersama: densitas 5,0 kkal/ml pada
 * produk 100 kkal per 90 ml, atau usia maksimal 12 bulan dengan usia minimal
 * 24 bulan sehingga produk tidak akan cocok untuk umur mana pun. Sekarang
 * ketiga hubungan berikut ditegakkan pada saat simpan.
 */
const TOLERANSI = { densitasPersen: 5, volumeSajiPersen: 10 } as const

const medanProdukPKMK = z.object({
  id: z.string().optional(),
  nama: z
    .string({ required_error: 'Nama produk susu wajib diisi.' })
    .trim()
    .min(2, 'Nama produk minimal 2 karakter.')
    .max(100, 'Nama produk maksimal 100 karakter.'),
  merek: z
    .string({ required_error: 'Merek / pabrikan wajib diisi.' })
    .trim()
    .min(2, 'Merek minimal 2 karakter.')
    .max(100, 'Merek maksimal 100 karakter.'),
  kkalPerSaji: z.coerce
    .number({ invalid_type_error: 'Kalori per saji harus berupa angka.' })
    .positive('Kalori per saji harus lebih dari 0 kkal.')
    .max(2000, 'Kalori per saji tidak masuk akal (> 2000 kkal).'),
  sendokPerSaji: z.coerce
    .number({ invalid_type_error: 'Jumlah sendok per saji harus berupa angka.' })
    .int('Jumlah sendok harus bilangan bulat.')
    .min(1, 'Jumlah sendok per saji minimal 1 sendok.')
    .max(30, 'Jumlah sendok per saji maksimal 30 sendok.'),
  densitasKkalPerMl: z.coerce
    .number({ invalid_type_error: 'Densitas kkal/ml harus berupa angka.' })
    .positive('Densitas harus lebih besar dari 0.')
    .max(5, 'Densitas kalori maksimal 5 kkal/ml.')
    .default(1.0),
  mlAirPerSendok: z.coerce
    .number({ invalid_type_error: 'Takaran air per sendok harus berupa angka.' })
    .positive('Takaran air per sendok harus lebih besar dari 0 ml.')
    .max(200, 'Takaran air per sendok maksimal 200 ml.')
    .default(30),
  mlPerSaji: z.coerce
    .number({ invalid_type_error: 'Volume saji jadi harus berupa angka.' })
    .positive('Volume per saji harus lebih besar dari 0 ml.')
    .max(1000, 'Volume saji maksimal 1000 ml.')
    .default(180),
  minUsiaBulan: z.coerce
    .number({ invalid_type_error: 'Minimal usia harus berupa angka.' })
    .int('Minimal usia harus bilangan bulat.')
    .min(0, 'Minimal usia tidak boleh negatif.')
    .max(60, 'Minimal usia maksimal 60 bulan.')
    .default(12),
  maksUsiaBulan: z.coerce
    .number({ invalid_type_error: 'Maksimal usia harus berupa angka.' })
    .int('Maksimal usia harus bilangan bulat.')
    .min(0, 'Maksimal usia tidak boleh negatif.')
    .max(120, 'Maksimal usia maksimal 120 bulan.')
    .nullable()
    .optional(),
  proteinGPer100ml: z.coerce
    .number({ invalid_type_error: 'Protein harus berupa angka.' })
    .min(0, 'Protein tidak boleh negatif.')
    .max(50, 'Protein tidak boleh melebihi 50g.')
    .nullable()
    .optional(),
  gramPerSendokTakar: z.coerce
    .number({ invalid_type_error: 'Gram per sendok harus berupa angka.' })
    .min(0, 'Gram per sendok tidak boleh negatif.')
    .max(100, 'Gram per sendok tidak boleh melebihi 100g.')
    .nullable()
    .optional(),
  anjuranKlinis: z
    .string()
    .trim()
    .max(500, 'Anjuran klinis maksimal 500 karakter.')
    .default('Periksa label kemasan untuk indikasi usia dan cara penyiapan.'),
  isActive: z.coerce.boolean().default(true),
})

export const skemaProdukPKMKAdmin = medanProdukPKMK
  .superRefine((d, ctx) => {
    // 1. Usia maksimal tidak boleh mendahului usia minimal.
    if (d.maksUsiaBulan != null && d.maksUsiaBulan < d.minUsiaBulan) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maksUsiaBulan'],
        message:
          `Usia maksimal (${d.maksUsiaBulan} bulan) tidak boleh lebih kecil daripada ` +
          `usia minimal (${d.minUsiaBulan} bulan). Produk tidak akan cocok untuk umur mana pun.`,
      })
    }

    // 2. Densitas wajib sejalan dengan kkal per saji dibagi volume per saji.
    if (d.mlPerSaji > 0) {
      const densitasLabel = d.kkalPerSaji / d.mlPerSaji
      const selisih = Math.abs((d.densitasKkalPerMl - densitasLabel) / densitasLabel) * 100
      if (selisih > TOLERANSI.densitasPersen) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['densitasKkalPerMl'],
          message:
            `Densitas ${d.densitasKkalPerMl} kkal/ml bertentangan dengan label produk ini: ` +
            `${d.kkalPerSaji} kkal ÷ ${d.mlPerSaji} ml = ${densitasLabel.toFixed(2)} kkal/ml ` +
            `(selisih ${selisih.toFixed(0)}%). Perbaiki salah satu angka agar sejalan.`,
        })
      }
    }

    // 3. Volume per saji wajib sejalan dengan sendok x air per sendok.
    const rekonstruksi = d.sendokPerSaji * d.mlAirPerSendok
    const selisihVolume = Math.abs((rekonstruksi - d.mlPerSaji) / d.mlPerSaji) * 100
    if (selisihVolume > TOLERANSI.volumeSajiPersen) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['mlAirPerSendok'],
        message:
          `${d.sendokPerSaji} sendok × ${d.mlAirPerSendok} ml air = ${rekonstruksi} ml, ` +
          `sedangkan volume per saji diisi ${d.mlPerSaji} ml (selisih ${selisihVolume.toFixed(0)}%). ` +
          'Periksa kembali label kemasan; kedua angka harus menggambarkan saji yang sama.',
      })
    }
  })

export type InputProdukPKMKAdmin = z.infer<typeof medanProdukPKMK>
