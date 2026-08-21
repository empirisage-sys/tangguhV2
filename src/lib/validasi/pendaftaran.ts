/**
 * Skema validasi pendaftaran dan masuk.
 *
 * Mengikuti arsitektur registrasi bertingkat:
 * 1. Provinsi (38 provinsi)
 * 2. Kabupaten/Kota
 * 3. Jenis Fasilitas (Puskesmas | Rumah Sakit)
 * 4. Nama Fasilitas (Master dropdown / Usulan Manual)
 * 5. Posyandu Manual (khusus kader)
 *
 * Aturan yang ditegakkan di sini diduplikasi di tiga lapisan:
 *   1. berkas ini (Zod validasi klien & server)
 *   2. Server Action (otentikasi & idempoten)
 *   3. batasan `check` & trigger di Postgres
 */
import { z } from 'zod'

/** Peran yang boleh dipilih saat mendaftar. `admin` tidak termasuk. */
export const PERAN_PENDAFTARAN = ['kader', 'dokter', 'dietisien'] as const
export type PeranPendaftaran = (typeof PERAN_PENDAFTARAN)[number]

export const LABEL_PERAN: Record<PeranPendaftaran, string> = {
  kader: 'Kader posyandu',
  dokter: 'Dokter',
  dietisien: 'Dietisien atau nutrisionis',
}

export const JENIS_FASKES = ['puskesmas', 'rumah_sakit'] as const
export type JenisFaskesPendaftaran = (typeof JENIS_FASKES)[number]

export const LABEL_JENIS_FASKES: Record<JenisFaskesPendaftaran, string> = {
  puskesmas: 'Puskesmas (Pusat Kesehatan Masyarakat)',
  rumah_sakit: 'Rumah Sakit (RSUD / RS Swasta)',
}

/**
 * Kata sandi.
 * Panjang minimum 10 karakter untuk keamanan optimal.
 */
const sandi = z
  .string()
  .min(10, 'Kata sandi minimal 10 karakter. Kalimat pendek lebih mudah diingat.')
  .max(72, 'Kata sandi maksimal 72 karakter')

const email = z
  .string()
  .trim()
  .toLowerCase()
  .email('Alamat email belum benar. Contoh: nama@puskesmas.go.id')

const noHp = z
  .string()
  .trim()
  .regex(/^(\+62|62|0)8\d{7,12}$/, 'Nomor HP diawali 08 atau +628, contoh 081234567890')

export const skemaPendaftaran = z
  .object({
    email,
    sandi,
    ulangiSandi: z.string(),
    namaLengkap: z
      .string()
      .trim()
      .min(3, 'Nama lengkap minimal 3 huruf')
      .max(100, 'Nama lengkap maksimal 100 huruf'),
    peran: z.enum(PERAN_PENDAFTARAN, {
      message: 'Pilih peran Anda: kader posyandu, dokter, atau dietisien',
    }),
    noHp,
    noStr: z.string().trim().max(50).optional().or(z.literal('')),

    // Wilayah Bertingkat
    provinsiId: z.string().min(1, 'Pilih provinsi tempat Anda bertugas'),
    kabupatenId: z.string().optional().or(z.literal('')),
    kabupatenManual: z.string().trim().max(100).optional().or(z.literal('')),

    // Fasilitas Kesehatan
    jenisFaskes: z.enum(JENIS_FASKES, {
      message: 'Pilih jenis fasilitas: Puskesmas atau Rumah Sakit',
    }),
    faskesId: z.string().optional().or(z.literal('')),
    faskesManual: z.string().trim().max(150).optional().or(z.literal('')),

    // Posyandu (Khusus Kader)
    posyanduManual: z.string().trim().max(150).optional().or(z.literal('')),

    /** Persetujuan pengolahan data pribadi, wajib menurut UU Pelindungan Data Pribadi. */
    setujuKetentuan: z.literal(true, {
      message: 'Centang persetujuan pengolahan data untuk melanjutkan',
    }),
  })
  .refine((d) => d.sandi === d.ulangiSandi, {
    message: 'Ulangi kata sandi belum sama',
    path: ['ulangiSandi'],
  })
  .refine((d) => d.peran === 'kader' || (d.noStr ?? '').trim().length >= 5, {
    message: 'Nomor STR wajib diisi minimal 5 karakter untuk dokter dan dietisien',
    path: ['noStr'],
  })
  // Validasi Kabupaten (wajib pilih atau isi manual jika luar Gorontalo)
  .refine(
    (d) => (d.provinsiId === 'prov-75' ? Boolean(d.kabupatenId) : Boolean(d.kabupatenManual?.trim() || d.kabupatenId)),
    {
      message: 'Pilih atau isi kabupaten/kota tempat Anda bertugas',
      path: ['kabupatenId'],
    },
  )
  // Validasi Faskes Rumah Sakit: selalu wajib isi faskesManual
  .refine(
    (d) => d.jenisFaskes !== 'rumah_sakit' || Boolean(d.faskesManual && d.faskesManual.trim().length >= 3),
    {
      message: 'Tuliskan nama lengkap Rumah Sakit tempat Anda bertugas',
      path: ['faskesManual'],
    },
  )
  // Validasi Faskes Puskesmas Gorontalo: wajib faskesId kecuali 'lainnya' yang wajib faskesManual
  .refine(
    (d) => {
      if (d.jenisFaskes !== 'puskesmas' || d.provinsiId !== 'prov-75') return true
      if (d.faskesId === 'lainnya') {
        return Boolean(d.faskesManual && d.faskesManual.trim().length >= 3)
      }
      return Boolean(d.faskesId && d.faskesId.trim().length > 0)
    },
    {
      message: 'Pilih Puskesmas Anda dari daftar, atau tuliskan nama Puskesmas jika memilih Lainnya',
      path: ['faskesId'],
    },
  )
  // Validasi Faskes Puskesmas Luar Gorontalo: selalu wajib faskesManual
  .refine(
    (d) => {
      if (d.jenisFaskes !== 'puskesmas' || d.provinsiId === 'prov-75') return true
      return Boolean(d.faskesManual && d.faskesManual.trim().length >= 3)
    },
    {
      message: 'Tuliskan nama Puskesmas tempat Anda bertugas',
      path: ['faskesManual'],
    },
  )
  // Validasi Posyandu: kader wajib isi posyanduManual
  .refine(
    (d) => d.peran !== 'kader' || Boolean(d.posyanduManual && d.posyanduManual.trim().length >= 3),
    {
      message: 'Tuliskan nama Posyandu tempat Anda bertugas sebagai kader',
      path: ['posyanduManual'],
    },
  )

export type MasukanPendaftaran = z.output<typeof skemaPendaftaran>

export const skemaMasuk = z.object({
  email,
  sandi: z.string().min(1, 'Kata sandi belum diisi'),
})

export type MasukanMasuk = z.output<typeof skemaMasuk>

export const skemaVerifikasi = z
  .object({
    penggunaId: z.string().min(1, 'ID pengguna tidak boleh kosong'),
    setujui: z.boolean(),
    alasan: z.string().trim().optional(),
    faskesMasterId: z.string().optional(),
  })
  .refine((d) => d.setujui || (d.alasan && d.alasan.trim().length >= 10), {
    message: 'Tuliskan alasan penolakan minimal 10 karakter',
    path: ['alasan'],
  })

export type MasukanVerifikasi = z.output<typeof skemaVerifikasi>

export function normalkanNoHp(masukan: string): string {
  const angka = masukan.replace(/\D/g, '')
  if (angka.startsWith('62')) return `0${angka.slice(2)}`
  if (angka.startsWith('8')) return `0${angka}`
  return angka
}
