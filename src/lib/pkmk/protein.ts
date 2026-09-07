/**
 * Panduan kecukupan protein hewani harian pada bayi dan balita.
 *
 * Sumber: Tabel 1.3, Sjarif DR (2022).
 *
 * ATURAN MODUL INI
 * ----------------
 * Angka dan menu di bawah disalin apa adanya dari tabel sumber. Jangan
 * menambah, menggabungkan, atau "merapikan" variasi menu — ketiganya adalah
 * pilihan setara yang ditawarkan sumber agar keluarga dapat memakai bahan yang
 * tersedia. Menghapus salah satunya menghilangkan pilihan itu.
 *
 * BATAS UMUR
 * ----------
 * Tabel sumber memakai 6-11, 13-24, dan 24-60 bulan, sehingga umur 12 bulan
 * tidak tercakup dan 24 bulan muncul dua kali. Agar tidak ada balita yang
 * kehilangan panduan, penyaringan di sini memakai 6-11, 12-23, dan 24-60,
 * sementara label yang DICETAK tetap menuliskan rentang asli dari sumber.
 */

export type KelompokProtein = {
  /** Rentang umur sebagaimana tertulis pada tabel sumber. */
  labelUmur: string
  /** Batas penyaringan yang dipakai aplikasi, dalam bulan. */
  umurMinBulan: number
  umurMaksBulan: number
  /** Angka Kecukupan Gizi protein, gram per hari. */
  akgProteinGram: number
  /** Sumber protein tambahan dari posyandu. */
  sumberTambahanPosyandu: string
  /** Tiga variasi sumber protein utama. Setara, bukan berurut prioritas. */
  variasi: [string, string, string]
}

/** Kutipan ringkas, untuk tempat sempit seperti tepi kanan judul tabel. */
export const SUMBER_PANDUAN_PROTEIN_RINGKAS = 'Sjarif DR (2022), Tabel 1.3'

export const SUMBER_PANDUAN_PROTEIN = 'Tabel 1.3 Panduan Kecukupan Protein Hewani Harian pada Bayi dan Balita (Sjarif DR, 2022)'

export const PANDUAN_PROTEIN: KelompokProtein[] = [
  {
    labelUmur: '6 – 11 bulan',
    umurMinBulan: 6,
    umurMaksBulan: 11,
    akgProteinGram: 15,
    sumberTambahanPosyandu: '1 telur',
    variasi: [
      '1 sdm daging sapi cincang/ikan/ayam',
      '½ – 1 hati ayam',
      '1 telur',
    ],
  },
  {
    labelUmur: '13 – 24 bulan',
    umurMinBulan: 12,
    umurMaksBulan: 23,
    akgProteinGram: 20,
    sumberTambahanPosyandu: '1 telur + 1 susu UHT',
    variasi: [
      '1 hati ayam',
      '1 telur + 1 sdm daging sapi/ikan/ayam',
      '1 telur + 1 susu UHT',
    ],
  },
  {
    labelUmur: '24 – 60 bulan',
    umurMinBulan: 24,
    umurMaksBulan: 60,
    akgProteinGram: 25,
    sumberTambahanPosyandu: '3 susu UHT',
    variasi: [
      '1 telur + 1 hati ayam',
      '1 telur + 3 sdm daging sapi/ikan',
      '2 telur',
    ],
  },
]

/**
 * Kelompok panduan protein untuk umur tertentu.
 *
 * Mengembalikan `null` bila umur di luar seluruh rentang, misalnya bayi di
 * bawah 6 bulan yang masih ASI eksklusif. Tidak dijepit ke kelompok terdekat:
 * memberi panduan makan padat kepada bayi yang belum waktunya lebih berbahaya
 * daripada tidak mencetak apa pun.
 */
export function proteinUntukUmur(umurBulan: number): KelompokProtein | null {
  if (!Number.isFinite(umurBulan)) return null
  return (
    PANDUAN_PROTEIN.find(
      (k) => umurBulan >= k.umurMinBulan && umurBulan <= k.umurMaksBulan,
    ) ?? null
  )
}
