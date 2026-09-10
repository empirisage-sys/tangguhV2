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
  constructor(nilai: string, nama: string, alasan = 'harus berformat YYYY-MM-DD') {
    super(`${nama} ${alasan}, diterima: "${nilai}"`)
    this.name = 'TanggalTidakValidError'
  }
}

/**
 * Tahun paling awal yang diterima sebagai tanggal lahir.
 *
 * ==========================================================================
 * TEMUAN LAPANGAN: KOTAK TANGGAL MENGIRIM TAHUN SATU DIGIT SAAT DIKETIK
 *
 * Medan `<input type="date">` mengirim nilai pada SETIAP ketukan. Saat pengguna
 * mengetik tahun "2026" satu angka demi satu angka, nilainya melewati
 * "0002-01-01", "0020-01-01", "0202-01-01" sebelum sampai "2026-01-01".
 *
 * Ketiganya lolos pemeriksaan pola YYYY-MM-DD. Yang kemudian menolaknya adalah
 * `Date.UTC`, yang memetakan tahun 0-99 ke 1900+tahun, sehingga pemeriksaan
 * pulang-pergi gagal — dan pesan galatnya berbunyi "harus berformat
 * YYYY-MM-DD" untuk nilai yang formatnya justru sudah benar.
 *
 * Batas ini membuat penolakannya jujur dan mudah dibaca. Yang lebih penting:
 * lapisan tampilan WAJIB memakai `tanggalValid()` sebelum menghitung, sebab
 * nilai setengah ketik itu keadaan yang sepenuhnya normal.
 * ==========================================================================
 */
export const TAHUN_MIN = 1900

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
    throw new TanggalTidakValidError(
      tanggal,
      namaField,
      'memuat bulan atau tanggal yang tidak ada',
    )
  }

  // Ditolak lebih dahulu supaya pesannya benar. Tanpa cabang ini, tahun 0-99
  // gagal pada pemeriksaan pulang-pergi di bawah dan dilaporkan sebagai
  // kesalahan FORMAT, padahal formatnya sudah benar.
  if (tahun < TAHUN_MIN) {
    throw new TanggalTidakValidError(
      tanggal,
      namaField,
      `memuat tahun yang tidak masuk akal (minimal ${TAHUN_MIN})`,
    )
  }

  const ms = Date.UTC(tahun, bulan - 1, hari)
  const d = new Date(ms)

  // Menolak tanggal yang tidak ada, misalnya 2026-02-30 yang akan bergeser ke Maret.
  if (
    d.getUTCFullYear() !== tahun ||
    d.getUTCMonth() !== bulan - 1 ||
    d.getUTCDate() !== hari
  ) {
    throw new TanggalTidakValidError(
      tanggal,
      namaField,
      'menunjuk tanggal yang tidak ada pada kalender',
    )
  }

  return Math.round(ms / 86_400_000)
}

/**
 * `true` bila tanggal ini aman dihitung. TIDAK PERNAH melempar.
 *
 * Dipakai lapisan tampilan sebelum memanggil perhitungan apa pun atas nilai
 * yang berasal dari medan tanggal. Komponen React menghitung ulang pada setiap
 * ketukan; satu lemparan di sana bukan pesan galat, melainkan layar putih
 * bertuliskan "Application error: a client-side exception has occurred" yang
 * memaksa pengguna memuat ulang halaman dan kehilangan isian.
 */
export function tanggalValid(nilai: unknown): nilai is string {
  if (typeof nilai !== 'string' || nilai.length === 0) return false
  try {
    keHariEpoch(nilai)
    return true
  } catch {
    return false
  }
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

/**
 * Tanggal lahir yang harus dipakai fungsi yang HANYA menerima tanggal lahir.
 *
 * ==========================================================================
 * TEMUAN AUDIT T-1: KOREKSI PREMATURITAS DIKERJAKAN DI DUA TEMPAT DENGAN DUA
 * ATURAN YANG BERBEDA
 *
 * `hitungSkrining` sudah menerima `usiaGestasiMinggu` dan menegakkan seluruh
 * aturannya sendiri sejak perbaikan Z-4. Halaman skrining tamu tidak pernah
 * ikut berpindah: ia masih menyuntikkan TANGGAL LAHIR PALSU yang digeser
 * sebesar defisit prematuritas — persis pola yang temuan Z-4 hapus.
 *
 * Dua akibatnya nyata:
 *   1. Batas 24 bulan TIDAK ditegakkan. Anak umur 30 bulan yang lahir 32
 *      minggu tetap dikurangi 56 hari, menghasilkan Z TB/U -1,077 padahal
 *      seharusnya -1,454 — selisih 0,38 SD ke arah yang lebih baik daripada
 *      keadaan sebenarnya.
 *   2. Jejaknya hilang. Hasilnya melaporkan `umurDikoreksiPrematur: false` dan
 *      `defisitPrematurHari: 0`, sehingga baris yang umurnya dikoreksi tidak
 *      dapat dibedakan dari baris yang tidak.
 *
 * Fungsi ini ada untuk pemanggil yang memang hanya punya tanggal lahir, yaitu
 * `hitungVelocity`. Ia memakai ATURAN YANG SAMA dengan mesin: koreksi hanya
 * diterapkan bila `hitungUsiaKoreksi` menyatakan berlaku, termasuk batas
 * umurnya. Dengan begitu tidak ada lagi aturan kedua yang ditulis di halaman.
 * ==========================================================================
 */
export function tanggalLahirEfektif(
  tanggalLahir: string,
  tanggalRujukan: string,
  usiaGestasiMinggu?: number,
): string {
  const koreksi = hitungUsiaKoreksi(tanggalLahir, tanggalRujukan, usiaGestasiMinggu)
  if (!koreksi.isPrematur || koreksi.defisitHari <= 0) return tanggalLahir

  const ms = new Date(tanggalLahir + 'T00:00:00Z').getTime()
  return new Date(ms + koreksi.defisitHari * 86_400_000).toISOString().slice(0, 10)
}
