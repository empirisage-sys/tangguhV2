/**
 * Skema validasi untuk formulir skrining.
 *
 * Satu skema dipakai di tiga tempat sekaligus:
 *   1. formulir di perangkat kader (react-hook-form + zodResolver)
 *   2. Server Action sebelum menulis ke database
 *   3. antrean sinkronisasi offline sebelum data dikirim
 *
 * Batas angkanya sengaja disamakan dengan batasan `check` pada tabel `skrining`
 * di Postgres. Bila salah satu diubah, ubah keduanya. Database adalah pertahanan
 * terakhir, bukan pengganti validasi di sini.
 *
 * Seluruh pesan galat ditulis dalam bahasa yang dipakai kader: menyebutkan apa
 * yang salah dan apa yang harus dilakukan, tanpa istilah teknis.
 */
import { z } from 'zod'

const POLA_TANGGAL = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Memeriksa bahwa tanggal benar-benar ada dalam kalender.
 *
 * `Date.parse('2026-02-30')` mengembalikan angka yang sah dan menggesernya ke
 * 2 Maret tanpa peringatan apa pun. Pemeriksaan di bawah menolaknya, dengan
 * cara yang sama seperti `keHariEpoch` di `src/lib/zscore/umur.ts`.
 */
function tanggalAda(nilai: string): boolean {
  const cocok = POLA_TANGGAL.exec(nilai)
  if (!cocok) return false

  const tahun = Number(cocok[1])
  const bulan = Number(cocok[2])
  const hari = Number(cocok[3])
  if (bulan < 1 || bulan > 12 || hari < 1 || hari > 31) return false

  const d = new Date(Date.UTC(tahun, bulan - 1, hari))
  return (
    d.getUTCFullYear() === tahun &&
    d.getUTCMonth() === bulan - 1 &&
    d.getUTCDate() === hari
  )
}

const tanggal = (nama: string) =>
  z
    .string()
    .regex(POLA_TANGGAL, `${nama} belum diisi dengan benar`)
    .refine(tanggalAda, `${nama} tidak ada dalam kalender`)

/** Menerima koma sebagai pemisah desimal, karena itu yang diketik kader. */
const angkaDesimal = z.union([z.number(), z.string()]).transform((v, ctx) => {
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.').trim())
  if (!Number.isFinite(n)) {
    ctx.addIssue({ code: 'custom', message: 'Harus berupa angka' })
    return z.NEVER
  }
  return n
})

export const skemaSkrining = z
  .object({
    balitaId: z.string().uuid('Pilih balita dari daftar'),

    tanggalPeriksa: tanggal('Tanggal pemeriksaan'),

    beratKg: angkaDesimal.pipe(
      z
        .number()
        .min(0.5, 'Berat badan minimal 0,5 kg. Periksa kembali angka di timbangan.')
        .max(40, 'Berat badan maksimal 40 kg. Periksa kembali angka di timbangan.'),
    ),

    panjangCm: angkaDesimal.pipe(
      z
        .number()
        .min(30, 'Panjang badan minimal 30 cm. Periksa kembali angka di alat ukur.')
        .max(140, 'Panjang badan maksimal 140 cm. Periksa kembali angka di alat ukur.'),
    ),

    posisiUkur: z.enum(['terlentang', 'berdiri', 'otomatis'], {
      message: 'Pilih posisi saat mengukur',
    }),

    lilaCm: angkaDesimal
      .pipe(z.number().min(5, 'LILA minimal 5 cm').max(30, 'LILA maksimal 30 cm'))
      .optional(),

    lingkarKepalaCm: angkaDesimal
      .pipe(z.number().min(25, 'Lingkar kepala minimal 25 cm').max(60, 'Lingkar kepala maksimal 60 cm'))
      .optional(),

    edema: z.boolean().default(false),

    catatan: z.string().max(500, 'Catatan maksimal 500 karakter').optional(),

    /**
     * Dibuat di perangkat sebelum pengiriman pertama, dan tidak pernah berubah
     * meskipun pengiriman diulang. Inilah yang mencegah data ganda saat sinyal
     * di posyandu terputus di tengah pengiriman.
     */
    clientUuid: z.string().uuid('Penanda pengiriman tidak sah'),
  })
  .refine(
    (d) => d.tanggalPeriksa <= new Date().toISOString().slice(0, 10),
    {
      message: 'Tanggal pemeriksaan tidak boleh melewati hari ini',
      path: ['tanggalPeriksa'],
    },
  )

export type MasukanSkrining = z.output<typeof skemaSkrining>

/**
 * Pemeriksaan yang membutuhkan tanggal lahir balita, sehingga tidak bisa
 * dilakukan di dalam skema formulir.
 */
export function periksaTerhadapBalita(
  masukan: Pick<MasukanSkrining, 'tanggalPeriksa'>,
  tanggalLahir: string,
): { ok: true } | { ok: false; pesan: string } {
  if (masukan.tanggalPeriksa < tanggalLahir) {
    return {
      ok: false,
      pesan: 'Tanggal pemeriksaan mendahului tanggal lahir balita. Periksa kembali tanggalnya.',
    }
  }

  const hari =
    (Date.parse(masukan.tanggalPeriksa) - Date.parse(tanggalLahir)) / 86_400_000
  if (hari > 1857) {
    return {
      ok: false,
      pesan:
        'Umur balita melebihi 60 bulan. Aplikasi ini memakai standar WHO 0 sampai 60 bulan, ' +
        'sehingga hasilnya tidak dapat dinilai.',
    }
  }

  return { ok: true }
}

export const skemaBalita = z.object({
  nama: z
    .string()
    .trim()
    .min(3, 'Nama balita minimal 3 huruf')
    .max(100, 'Nama balita maksimal 100 huruf'),
  tanggalLahir: tanggal('Tanggal lahir'),
  jenisKelamin: z.enum(['L', 'P'], { message: 'Pilih jenis kelamin' }),
  nik: z
    .string()
    .regex(/^\d{16}$/, 'NIK terdiri dari 16 angka')
    .optional()
    .or(z.literal('')),
  namaIbu: z.string().trim().max(100).optional(),
  namaAyah: z.string().trim().max(100).optional(),
  noHpOrtu: z
    .string()
    .regex(/^(\+62|0)8\d{7,12}$/, 'Nomor HP diawali 08 atau +628')
    .optional()
    .or(z.literal('')),
  alamat: z.string().trim().max(300).optional(),
  posyanduId: z.string().uuid('Pilih posyandu'),
  bbLahirGram: angkaDesimal
    .pipe(z.number().int().min(300, 'Berat lahir minimal 300 g').max(7000, 'Berat lahir maksimal 7000 g'))
    .optional(),
  pbLahirCm: angkaDesimal
    .pipe(z.number().min(20, 'Panjang lahir minimal 20 cm').max(70, 'Panjang lahir maksimal 70 cm'))
    .optional(),
})

export type MasukanBalita = z.output<typeof skemaBalita>
