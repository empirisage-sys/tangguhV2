/**
 * Perhitungan umur dan usia koreksi prematuritas.
 *
 * Aturan yang dipegang di berkas ini:
 *
 * 1. Tanggal diperlakukan sebagai tanggal murni, tanpa jam, menit, atau zona
 *    waktu. Satu-satunya masukan yang diterima adalah string YYYY-MM-DD.
 *    Alasannya: memakai `new Date()` pada string bertanda waktu akan menggeser
 *    tanggal satu hari di zona waktu Indonesia, dan pada bayi baru lahir
 *    selisih satu hari mengubah hasil Z-Score.
 *
 * 2. Umur dalam bulan dihitung sebagai hari dibagi 30,4375 — konvensi yang
 *    dipakai aplikasi versi Firebase dan lazim pada implementasi WHO berbasis
 *    tabel bulanan. Nilainya dipertahankan agar hasil dapat dibandingkan
 *    dengan data lama.
 *
 * 3. Usia koreksi prematuritas (Prematurity Corrected Age) dihitung dengan
 *    mengurangi umur kronologis sebanyak selisih usia gestasi terhadap 40 minggu
 *    (defisit minggu * 7 hari).
 */

/** Rata-rata jumlah hari dalam satu bulan menurut konvensi WHO (365,25 / 12). */
export const HARI_PER_BULAN = 30.4375

const POLA_TANGGAL = /^(\d{4})-(\d{2})-(\d{2})$/

export class TanggalTidakValidError extends Error {
  constructor(nilai: string, nama: string) {
    super(`${nama} harus berformat YYYY-MM-DD, diterima: "${nilai}"`)
    this.name = 'TanggalTidakValidError'
  }
}

/**
 * Mengubah string YYYY-MM-DD menjadi jumlah hari sejak epoch.
 * Memakai Date.UTC agar hasilnya tidak bergantung zona waktu perangkat.
 */
export function keHariEpoch(tanggal: string, namaField = 'Tanggal'): number {
  const cocok = POLA_TANGGAL.exec(tanggal)
  if (!cocok) throw new TanggalTidakValidError(tanggal, namaField)

  const tahun = Number(cocok[1])
  const bulan = Number(cocok[2])
  const hari = Number(cocok[3])

  if (bulan < 1 || bulan > 12 || hari < 1 || hari > 31) {
    throw new TanggalTidakValidError(tanggal, namaField)
  }

  const ms = Date.UTC(tahun, bulan - 1, hari)
  const d = new Date(ms)

  // Menolak tanggal yang tidak ada, misalnya 2026-02-30 yang akan bergeser ke Maret.
  if (
    d.getUTCFullYear() !== tahun ||
    d.getUTCMonth() !== bulan - 1 ||
    d.getUTCDate() !== hari
  ) {
    throw new TanggalTidakValidError(tanggal, namaField)
  }

  return Math.round(ms / 86_400_000)
}

/** Selisih dua tanggal dalam hari penuh. Bernilai negatif bila akhir mendahului awal. */
export function selisihHari(awal: string, akhir: string): number {
  return keHariEpoch(akhir, 'Tanggal akhir') - keHariEpoch(awal, 'Tanggal awal')
}

export type Umur = {
  hari: number
  /** Umur desimal dalam bulan, dipakai untuk interpolasi tabel. */
  bulan: number
  /** Pecahan tahun dan bulan penuh, untuk ditampilkan kepada pengguna. */
  tampilan: { tahun: number; bulanSisa: number }
}

export function hitungUmur(tanggalLahir: string, tanggalPeriksa: string): Umur {
  const hari = selisihHari(tanggalLahir, tanggalPeriksa)
  const bulan = hari / HARI_PER_BULAN
  const bulanPenuh = Math.floor(bulan)

  return {
    hari,
    bulan,
    tampilan: {
      tahun: Math.floor(bulanPenuh / 12),
      bulanSisa: bulanPenuh % 12,
    },
  }
}

export type UmurKalender = {
  tahun: number
  bulan: number
  hari: number
  totalHari: number
  totalBulanDesimal: number
  teks: string
}

/**
 * Menghitung umur dalam pecahan kalender: Tahun, Bulan, dan Hari.
 * Contoh: 2 Tahun 2 Bulan 19 Hari (810 Hari).
 */
export function hitungUmurKalender(tanggalLahir: string, tanggalPeriksa: string): UmurKalender {
  // Validasi lebih dulu, dengan penjaga yang sama seperti `keHariEpoch`.
  // Versi sebelumnya mem-parsing langsung dan hanya terselamatkan karena
  // `selisihHari` di bawah melempar galat — kebetulan, bukan rancangan (Z-19).
  keHariEpoch(tanggalLahir, 'Tanggal lahir')
  keHariEpoch(tanggalPeriksa, 'Tanggal periksa')

  const tLahir = new Date(tanggalLahir + 'T00:00:00Z')
  const tPeriksa = new Date(tanggalPeriksa + 'T00:00:00Z')

  let tahun = tPeriksa.getUTCFullYear() - tLahir.getUTCFullYear()
  let bulan = tPeriksa.getUTCMonth() - tLahir.getUTCMonth()
  let hari = tPeriksa.getUTCDate() - tLahir.getUTCDate()

  if (hari < 0) {
    const bulanSebelumnya = new Date(Date.UTC(tPeriksa.getUTCFullYear(), tPeriksa.getUTCMonth(), 0))
    hari += bulanSebelumnya.getUTCDate()
    bulan -= 1
  }

  if (bulan < 0) {
    bulan += 12
    tahun -= 1
  }

  const totalHari = selisihHari(tanggalLahir, tanggalPeriksa)
  const totalBulanDesimal = Math.round((totalHari / HARI_PER_BULAN) * 100) / 100

  const teksBagian: string[] = []
  if (tahun > 0) teksBagian.push(`${tahun} Tahun`)
  if (bulan > 0 || tahun > 0) teksBagian.push(`${bulan} Bulan`)
  teksBagian.push(`${hari} Hari`)

  return {
    tahun: Math.max(0, tahun),
    bulan: Math.max(0, bulan),
    hari: Math.max(0, hari),
    totalHari,
    totalBulanDesimal,
    teks: teksBagian.join(' '),
  }
}

/**
 * Usia gestasi yang dianggap cukup bulan. Di atas ini tidak ada koreksi.
 */
export const GESTASI_CUKUP_BULAN_MINGGU = 37

/** Batas kewajaran usia gestasi yang boleh diterima sebagai masukan. */
export const GESTASI_MIN_MINGGU = 22
export const GESTASI_MAKS_MINGGU = 42

/**
 * Umur (dalam bulan, memakai umur KOREKSI) sampai kapan koreksi prematuritas
 * masih diterapkan.
 *
 * ==========================================================================
 * MENUNGGU KEPUTUSAN KLINIS
 * Nilai 24 bulan adalah konvensi yang paling lazim, dan sebagian panduan
 * memakai 36 bulan untuk prematur ekstrem. Angka ini WAJIB dikonfirmasi dokter
 * spesialis anak sebelum dipakai di lapangan, lalu catat keputusannya di sini.
 *
 * Sebelum perbaikan ini, koreksi diterapkan pada umur BERAPA PUN: anak 5 tahun
 * yang lahir 24 minggu tetap dikurangi 3,7 bulan. Lihat temuan audit Z-4.
 * ==========================================================================
 */
export const BATAS_UMUR_KOREKSI_PREMATUR_BULAN = 24

export type UsiaKoreksiPrematur = {
  isPrematur: boolean
  /**
   * `true` bila anak memang lahir prematur tetapi umurnya sudah melewati
   * `BATAS_UMUR_KOREKSI_PREMATUR_BULAN`, sehingga koreksi TIDAK diterapkan.
   */
  koreksiKedaluwarsa: boolean
  usiaGestasiMinggu: number
  defisitMinggu: number
  defisitHari: number
  umurKronologis: UmurKalender
  umurKoreksi: UmurKalender
  teksKoreksi: string
}

function tanpaKoreksi(
  kronologis: UmurKalender,
  usiaGestasiMinggu: number | undefined,
  kedaluwarsa: boolean,
): UsiaKoreksiPrematur {
  return {
    isPrematur: false,
    koreksiKedaluwarsa: kedaluwarsa,
    usiaGestasiMinggu: usiaGestasiMinggu ?? 40,
    defisitMinggu: 0,
    defisitHari: 0,
    umurKronologis: kronologis,
    umurKoreksi: kronologis,
    teksKoreksi: kronologis.teks,
  }
}

/**
 * Menghitung usia koreksi bagi bayi lahir prematur (< 37 minggu gestasi).
 * Defisit prematuritas = (40 - usiaGestasi) minggu.
 *
 * Koreksi TIDAK diterapkan bila:
 *   - usia gestasi tidak diisi, atau di luar rentang wajar 22-42 minggu
 *   - usia gestasi >= 37 minggu (cukup bulan)
 *   - umur koreksi anak sudah melewati `batasUmurKoreksiBulan`
 *
 * Pada kasus terakhir, `koreksiKedaluwarsa` bernilai `true` supaya lapisan
 * tampilan dapat menjelaskan mengapa umur yang dipakai adalah umur kronologis.
 */
export function hitungUsiaKoreksi(
  tanggalLahir: string,
  tanggalPeriksa: string,
  usiaGestasiMinggu?: number,
  batasUmurKoreksiBulan: number = BATAS_UMUR_KOREKSI_PREMATUR_BULAN,
): UsiaKoreksiPrematur {
  const kronologis = hitungUmurKalender(tanggalLahir, tanggalPeriksa)

  const gestasiSah =
    typeof usiaGestasiMinggu === 'number' &&
    Number.isFinite(usiaGestasiMinggu) &&
    usiaGestasiMinggu >= GESTASI_MIN_MINGGU &&
    usiaGestasiMinggu <= GESTASI_MAKS_MINGGU

  if (!gestasiSah || usiaGestasiMinggu! >= GESTASI_CUKUP_BULAN_MINGGU) {
    return tanpaKoreksi(kronologis, usiaGestasiMinggu, false)
  }

  const defisitMinggu = Math.max(0, 40 - usiaGestasiMinggu!)
  const defisitHari = defisitMinggu * 7

  const tLahirMs = new Date(tanggalLahir + 'T00:00:00Z').getTime()
  const tLahirKoreksi = new Date(tLahirMs + defisitHari * 86_400_000).toISOString().slice(0, 10)

  const umurKoreksi = hitungUmurKalender(tLahirKoreksi, tanggalPeriksa)

  // Melewati batas umur koreksi: pakai umur kronologis, tetapi tandai.
  if (umurKoreksi.totalBulanDesimal > batasUmurKoreksiBulan) {
    return tanpaKoreksi(kronologis, usiaGestasiMinggu, true)
  }

  return {
    isPrematur: true,
    koreksiKedaluwarsa: false,
    usiaGestasiMinggu: usiaGestasiMinggu!,
    defisitMinggu,
    defisitHari,
    umurKronologis: kronologis,
    umurKoreksi,
    teksKoreksi: `${umurKoreksi.teks} (dikurangi ${defisitMinggu} minggu / ${defisitHari} hari)`,
  }
}
