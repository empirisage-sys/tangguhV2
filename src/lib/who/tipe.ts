/**
 * Tipe bersama untuk seluruh tabel referensi WHO.
 *
 * Kunci objek adalah nilai x sebagai angka: umur dalam bulan untuk tabel
 * berbasis umur, atau panjang/tinggi dalam sentimeter untuk tabel BB/PB dan BB/TB.
 * Nilainya adalah tripel [L, M, S].
 */
export type Lms = readonly [L: number, M: number, S: number]

export type TabelLms = Readonly<Record<number, Lms>>

export type JenisKelamin = 'lk' | 'pr'

/** Interval tabel velocity berat badan WHO yang tersedia di aplikasi ini. */
export type IntervalVelocity = '1bln' | '2bln' | '3bln'

/**
 * Satu tabel velocity WHO.
 *
 * PENTING — parameter `delta`:
 * WHO memodelkan tabel velocity pada data yang sudah digeser, yaitu
 * (kenaikan sebenarnya + delta). Karena itu nilai yang keluar dari rumus LMS
 * WAJIB dikurangi `delta` untuk memperoleh kenaikan berat yang sebenarnya.
 *
 * Contoh: perempuan interval 0-4 minggu, L=0.7781 M=1279.4834 S=0.21479, delta=400.
 *   Nilai LMS pada z = -1.645  -> 846 g
 *   Dikurangi delta            -> 446 g
 *   Persentil 5 pada tabel WHO -> 446 g   (cocok)
 *
 * Aplikasi TANGGUH versi Firebase tidak melakukan pengurangan ini, sehingga
 * ambang kenaikan minimal terlalu tinggi tepat sebesar delta pada setiap kasus.
 * Lihat TELAAH_KODE_LAMA_TANGGUH.md temuan K-3.
 */
export type TabelVelocity = {
  readonly deltaGram: number
  readonly bulanAwalMin: number
  readonly bulanAwalMaks: number
  readonly hariStandar: number
  readonly baris: Readonly<Record<number, Lms>>
}
