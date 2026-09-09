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
import type {
  AlasanCatchUpKosong,
  HasilGizi,
  MetodeKalori,
  StatusBBTB,
  StatusTBU,
} from './tipe'

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
 * Di mana panjang atau tinggi anak berada relatif terhadap rentang median TB/U.
 *
 * Dibutuhkan karena usia-tinggi TIDAK TERDEFINISI di luar rentang itu, dan
 * arah keluarnya menentukan apakah RDA masih dapat ditetapkan.
 */
export type PosisiUsiaTinggi =
  | 'dalam_tabel'
  /** Lebih pendek dari median lahir, misalnya bayi prematur. */
  | 'di_bawah_median_lahir'
  /** Lebih tinggi dari median umur 60 bulan. */
  | 'di_atas_median_60_bulan'

export type HasilUsiaTinggi = {
  bulan: number | null
  posisi: PosisiUsiaTinggi
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
export function cariUsiaTinggi(panjangCm: number, seks: JenisKelamin): HasilUsiaTinggi {
  const tabel = tabelUmur('tbu', seks)
  const { min, maks } = batasTabel(tabel)

  const medianPada = (bulan: number): number | null => {
    const { lms } = interpolasiLms(bulan, tabel, LANGKAH_UMUR_BULAN)
    return lms ? lms[1] : null
  }

  const medianMin = medianPada(min)
  const medianMaks = medianPada(maks)
  if (medianMin === null || medianMaks === null) {
    return { bulan: null, posisi: 'dalam_tabel' }
  }

  if (panjangCm < medianMin) return { bulan: null, posisi: 'di_bawah_median_lahir' }
  if (panjangCm > medianMaks) return { bulan: null, posisi: 'di_atas_median_60_bulan' }

  // Pencarian biner pada fungsi median yang monoton naik.
  let bawah = min
  let atas = maks
  for (let i = 0; i < 60; i += 1) {
    const tengah = (bawah + atas) / 2
    const m = medianPada(tengah)
    if (m === null) return { bulan: null, posisi: 'dalam_tabel' }
    if (m < panjangCm) bawah = tengah
    else atas = tengah
  }

  return {
    bulan: Math.round(((bawah + atas) / 2) * 100) / 100,
    posisi: 'dalam_tabel',
  }
}

/** Bentuk lama yang hanya mengembalikan angka. Dipertahankan untuk pemanggil lama. */
export function usiaTinggiBulan(panjangCm: number, seks: JenisKelamin): number | null {
  return cariUsiaTinggi(panjangCm, seks).bulan
}

/**
 * RDA untuk target tumbuh kejar, termasuk ketika usia-tinggi tidak terdefinisi.
 *
 * ==========================================================================
 * TEMUAN AUDIT K-1: TARGET TUMBUH KEJAR HILANG PADA ANAK PALING SAKIT
 *
 * Sebelum perbaikan ini, `usiaTinggiBulan` mengembalikan `null` begitu tinggi
 * anak melewati median TB/U umur 60 bulan (109,96 cm laki-laki). Akibatnya
 * SELURUH target tumbuh kejar dibuang, dan `metode` jatuh ke 'pemeliharaan'
 * tanpa satu pun catatan — `diLuarRentang` tetap `false` dan daftar alasannya
 * kosong. Anak laki-laki umur 58 bulan, 110 cm, 12,5 kg dengan BB/TB -4,54 SD
 * — gizi buruk — dianjurkan 1.125 kkal alih-alih sekitar 1.667 kkal, dan tidak
 * ada apa pun di layar yang memberi tahu dietisien bahwa angka tumbuh kejarnya
 * tidak terhitung.
 *
 * Perbaikannya tidak menebak nilai klinis apa pun. Alasannya aritmetika:
 * `TABEL_RDA` berbentuk tangga, dan kedua wilayah di luar tabel jatuh
 * SELURUHNYA di dalam satu anak tangga yang sama.
 *
 *   - Anak yang lebih tinggi dari median 60 bulan pasti berusia-tinggi di atas
 *     60 bulan, dan seluruh nilai di atas 36 bulan bernilai sama.
 *   - Anak yang lebih pendek dari median lahir berusia-tinggi di bawah 0 bulan,
 *     dan seluruh nilai sampai 12 bulan bernilai sama.
 *
 * Karena itu RDA-nya tertentu meskipun usia-tinggi tepatnya tidak diketahui.
 * Kesetaraan tangga itu DIPERIKSA saat berjalan, bukan diasumsikan: bila suatu
 * saat `TABEL_RDA` diubah sehingga anak tangganya tidak lagi seragam, fungsi
 * ini mengembalikan `null` alih-alih angka yang tidak sah.
 * ==========================================================================
 */
export function rdaCatchUpKkalPerKg(usiaTinggi: HasilUsiaTinggi): number | null {
  if (usiaTinggi.posisi === 'dalam_tabel') {
    return usiaTinggi.bulan === null ? null : rdaKkalPerKg(usiaTinggi.bulan)
  }

  if (usiaTinggi.posisi === 'di_atas_median_60_bulan') {
    const diTepi = rdaKkalPerKg(UMUR_MAKS_BULAN)
    const diTakHingga = rdaKkalPerKg(Number.POSITIVE_INFINITY)
    return diTepi === diTakHingga ? diTepi : null
  }

  const diNol = rdaKkalPerKg(0)
  const diMinusTakHingga = rdaKkalPerKg(Number.NEGATIVE_INFINITY)
  return diNol === diMinusTakHingga ? diNol : null
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
  /**
   * Status TB/U. Diteruskan agar keputusan tumbuh kejar dapat memperhitungkan
   * anak yang stunting tanpa wasting.
   *
   * ==========================================================================
   * MENUNGGU KEPUTUSAN KLINIS
   * Saat ini nilai ini TIDAK mengubah perilaku: target tumbuh kejar tetap
   * hanya dianjurkan untuk `gizi_kurang` dan `gizi_buruk`, persis seperti
   * sebelumnya. Anak dengan TB/U di bawah -2 SD tetapi BB/TB normal — profil
   * stunting kronis yang paling umum pada program ini — masih mendapat metode
   * `pemeliharaan`.
   *
   * Sebelumnya `statusTBU` bahkan tidak sampai ke lapisan ini, sehingga
   * keputusannya tidak mungkin diambil. Sekarang datanya tersedia; keputusan
   * apakah stunting tanpa wasting layak target tumbuh kejar menunggu dokter
   * spesialis anak / nutrisionis. Lihat temuan audit Z-7.
   * ==========================================================================
   */
  statusTBU?: StatusTBU | null
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
  const usiaTinggi: HasilUsiaTinggi =
    umurBulan <= UMUR_MAKS_BULAN
      ? cariUsiaTinggi(panjangTerkoreksiCm, jenisKelamin)
      : { bulan: null, posisi: 'dalam_tabel' }

  let rdaCatchUp: number | null = null
  let kaloriCatchUp: number | null = null
  let proteinCatchUpMin: number | null = null
  let proteinCatchUpMaks: number | null = null

  const beratIdealAda = beratIdealKg !== null && beratIdealKg > 0
  if (beratIdealAda) {
    rdaCatchUp = rdaCatchUpKkalPerKg(usiaTinggi)
    if (rdaCatchUp !== null) {
      kaloriCatchUp = Math.round(rdaCatchUp * (beratIdealKg as number))
      proteinCatchUpMin = bulatkanSatuDesimal(PROTEIN_CATCH_UP.min * (beratIdealKg as number))
      proteinCatchUpMaks = bulatkanSatuDesimal(PROTEIN_CATCH_UP.maks * (beratIdealKg as number))
    }
  }

  // --- 3. Metode yang dianjurkan ditampilkan sebagai target utama ---
  const perluCatchUp = statusBBTB === 'gizi_kurang' || statusBBTB === 'gizi_buruk'
  const metode: MetodeKalori =
    perluCatchUp && kaloriCatchUp !== null ? 'catch_up' : 'pemeliharaan'

  // Bila tumbuh kejar DIBUTUHKAN tetapi tidak dapat dihitung, alasannya wajib
  // ikut keluar. Inilah yang dahulu hilang tanpa jejak (temuan K-1).
  const alasanCatchUpKosong: AlasanCatchUpKosong =
    perluCatchUp && kaloriCatchUp === null
      ? !beratIdealAda
        ? 'berat_ideal_tidak_ada'
        : 'rda_tidak_tentu'
      : null

  return {
    beratIdealKg,
    usiaTinggiBulan: usiaTinggi.bulan,
    posisiUsiaTinggi: usiaTinggi.posisi,
    alasanCatchUpKosong,
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
