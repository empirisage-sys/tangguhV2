/**
 * Kebutuhan energi dan protein.
 *
 * ==========================================================================
 * PERINGATAN
 * Angka pada berkas ini menjadi dasar rekomendasi terapi gizi. Sebelum dipakai
 * di lapangan, rumus dan tabel RDA di bawah WAJIB diverifikasi dan ditandatangani
 * oleh dokter spesialis anak atau nutrisionis. Simpan lembar verifikasi itu
 * sebagai bagian dokumen validasi aplikasi.
 * ==========================================================================
 *
 * Berkas ini menghasilkan DUA angka, bukan satu:
 *
 * 1. Kebutuhan pemeliharaan = RDA(umur kronologis) x berat badan aktual.
 *    Ini yang dihitung aplikasi versi Firebase. Sesuai untuk anak berstatus
 *    gizi baik.
 *
 * 2. Target tumbuh kejar = RDA(usia-tinggi) x berat badan ideal untuk tinggi.
 *    Ini rumus yang tertulis di dokumen desain TANGGUH tetapi tidak pernah
 *    tersambung ke perhitungan. Bentuk aslinya di dokumen adalah
 *
 *        Target Kalori per kg = RDA(usia-tinggi) x BB ideal / BB aktual
 *
 *    yang bila dikalikan berat aktual untuk memperoleh kebutuhan harian
 *    menjadi RDA(usia-tinggi) x BB ideal. Bentuk terakhir itu yang dipakai
 *    di sini karena tidak menyisakan pembagian yang bisa membingungkan.
 *
 * Selisih keduanya nyata. Contoh anak laki-laki 24 bulan, tinggi 78 cm,
 * berat 8,0 kg: pemeliharaan 800 kkal/hari, tumbuh kejar 1.021 kkal/hari.
 * Lihat TELAAH_KODE_LAMA_TANGGUH.md temuan T-1 dan T-2.
 */
import { LANGKAH_UMUR_BULAN, tabelUmur, UMUR_MAKS_BULAN } from '@/lib/who'
import type { JenisKelamin } from '@/lib/who'
import { batasTabel, interpolasiLms } from './lms'
import type { HasilGizi, MetodeKalori, StatusBBTB } from './tipe'

/**
 * Tabel Recommended Dietary Allowance energi, satuan kkal per kg berat badan per hari.
 *
 * SUMBER YANG PERLU DIKONFIRMASI. Nilai 110 / 100 / 90 diambil apa adanya dari
 * fungsi `getRdaValue` di App.tsx aplikasi versi Firebase. Nilai-nilai ini lazim
 * dipakai dalam rumus catch-up growth pada literatur gizi anak, tetapi belum
 * dibandingkan dengan Angka Kecukupan Gizi Kemenkes versi terbaru.
 * Cantumkan sumbernya di sini setelah diverifikasi nutrisionis.
 */
const TABEL_RDA: ReadonlyArray<{ sampaiBulan: number; kkalPerKg: number }> = [
  { sampaiBulan: 12, kkalPerKg: 110 },
  { sampaiBulan: 36, kkalPerKg: 100 },
  { sampaiBulan: 72, kkalPerKg: 90 },
]

/** Rentang protein untuk kebutuhan pemeliharaan, gram per kg berat badan aktual per hari. */
const PROTEIN_PEMELIHARAAN = { min: 1.2, maks: 1.5 } as const

/** Rentang protein untuk target tumbuh kejar, gram per kg berat badan ideal per hari. */
const PROTEIN_CATCH_UP = { min: 1.5, maks: 2.0 } as const

export function rdaKkalPerKg(umurBulan: number): number {
  for (const baris of TABEL_RDA) {
    if (umurBulan <= baris.sampaiBulan) return baris.kkalPerKg
  }
  const terakhir = TABEL_RDA[TABEL_RDA.length - 1]
  return terakhir ? terakhir.kkalPerKg : 90
}

/**
 * Mencari usia-tinggi (height-age): umur yang mediannya setara panjang atau
 * tinggi badan anak, menurut tabel TB/U.
 *
 * PERBEDAAN DENGAN APLIKASI LAMA: fungsi `findMedianAgeForHeight` di App.tsx
 * memindai seluruh 61 baris tabel dan mengambil bulan dengan median terdekat,
 * sehingga hasilnya selalu bilangan bulat. Di sini nilainya diinterpolasi
 * sehingga resolusinya pecahan bulan. Median tabel TB/U meningkat monoton,
 * sehingga interpolasinya aman.
 *
 * Mengembalikan `null` bila panjang atau tinggi berada di luar rentang median
 * tabel, misalnya bayi prematur yang lebih pendek dari median lahir.
 */
export function usiaTinggiBulan(
  panjangCm: number,
  seks: JenisKelamin,
): number | null {
  const tabel = tabelUmur('tbu', seks)
  const { min, maks } = batasTabel(tabel)

  const medianPada = (bulan: number): number | null => {
    const { lms } = interpolasiLms(bulan, tabel, LANGKAH_UMUR_BULAN)
    return lms ? lms[1] : null
  }

  const medianMin = medianPada(min)
  const medianMaks = medianPada(maks)
  if (medianMin === null || medianMaks === null) return null

  if (panjangCm < medianMin) return null
  if (panjangCm > medianMaks) return null

  // Pencarian biner pada fungsi median yang monoton naik.
  let bawah = min
  let atas = maks
  for (let i = 0; i < 60; i += 1) {
    const tengah = (bawah + atas) / 2
    const m = medianPada(tengah)
    if (m === null) return null
    if (m < panjangCm) bawah = tengah
    else atas = tengah
  }

  return Math.round(((bawah + atas) / 2) * 100) / 100
}

export type InputGizi = {
  umurBulan: number
  beratKg: number
  /** Berat badan ideal menurut panjang atau tinggi, yaitu median tabel BB/PB atau BB/TB. */
  beratIdealKg: number | null
  /** Panjang atau tinggi badan yang sudah dikoreksi posisi. */
  panjangTerkoreksiCm: number
  jenisKelamin: JenisKelamin
  statusBBTB: StatusBBTB | null
}

function bulatkanSatuDesimal(n: number): number {
  return Math.round(n * 10) / 10
}

export function hitungKebutuhanGizi(input: InputGizi): HasilGizi {
  const { umurBulan, beratKg, beratIdealKg, panjangTerkoreksiCm, jenisKelamin, statusBBTB } = input

  // --- 1. Kebutuhan pemeliharaan (perilaku aplikasi lama) ---
  const rdaPemeliharaan = rdaKkalPerKg(umurBulan)
  const kaloriPemeliharaan = Math.round(rdaPemeliharaan * beratKg)
  const proteinPemeliharaanMin = bulatkanSatuDesimal(PROTEIN_PEMELIHARAAN.min * beratKg)
  const proteinPemeliharaanMaks = bulatkanSatuDesimal(PROTEIN_PEMELIHARAAN.maks * beratKg)

  // --- 2. Target tumbuh kejar ---
  const usiaTinggi =
    umurBulan <= UMUR_MAKS_BULAN ? usiaTinggiBulan(panjangTerkoreksiCm, jenisKelamin) : null

  let rdaCatchUp: number | null = null
  let kaloriCatchUp: number | null = null
  let proteinCatchUpMin: number | null = null
  let proteinCatchUpMaks: number | null = null

  if (usiaTinggi !== null && beratIdealKg !== null && beratIdealKg > 0) {
    rdaCatchUp = rdaKkalPerKg(usiaTinggi)
    kaloriCatchUp = Math.round(rdaCatchUp * beratIdealKg)
    proteinCatchUpMin = bulatkanSatuDesimal(PROTEIN_CATCH_UP.min * beratIdealKg)
    proteinCatchUpMaks = bulatkanSatuDesimal(PROTEIN_CATCH_UP.maks * beratIdealKg)
  }

  // --- 3. Metode yang dianjurkan ditampilkan sebagai target utama ---
  const perluCatchUp = statusBBTB === 'gizi_kurang' || statusBBTB === 'gizi_buruk'
  const metode: MetodeKalori =
    perluCatchUp && kaloriCatchUp !== null ? 'catch_up' : 'pemeliharaan'

  return {
    beratIdealKg,
    usiaTinggiBulan: usiaTinggi,
    rdaPemeliharaanKkalPerKg: rdaPemeliharaan,
    kaloriPemeliharaanKkal: kaloriPemeliharaan,
    proteinPemeliharaanMinGram: proteinPemeliharaanMin,
    proteinPemeliharaanMaksGram: proteinPemeliharaanMaks,
    rdaCatchUpKkalPerKg: rdaCatchUp,
    kaloriCatchUpKkal: kaloriCatchUp,
    proteinCatchUpMinGram: proteinCatchUpMin,
    proteinCatchUpMaksGram: proteinCatchUpMaks,
    metode,
  }
}
