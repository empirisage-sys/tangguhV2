import { z } from 'zod'

/**
 * Skema validasi produk PKMK (Pangan Olahan untuk Keperluan Medis Khusus)
 * Digunakan pada form penambahan dan pengubahan produk oleh Administrator.
 *
 * Catatan Klinis (D-5 & S-2):
 * `kkal_per_sendok` dihitung otomatis dari (kkal_per_saji / sendok_per_saji).
 * Nilai sendok_per_saji wajib > 0 agar tidak terjadi pembagian dengan nol.
 */
export const skemaProdukPKMKAdmin = z.object({
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

export type InputProdukPKMKAdmin = z.infer<typeof skemaProdukPKMKAdmin>
