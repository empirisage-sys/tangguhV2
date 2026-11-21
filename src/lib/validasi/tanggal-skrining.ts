/**
 * Pemeriksaan tanggal pada Skrining Tamu.
 *
 * ==========================================================================
 * TEMUAN UJI PRODUKSI 21 NOVEMBER 2026
 *
 * Halaman Skrining Tamu hanya memeriksa tanggal saat tombol "Hitung" ditekan,
 * dan hanya sebatas "terisi" dan "berformat sah". Akibatnya:
 *
 *   1. Tanggal lahir kosong tetap bisa lanjut ke langkah 2.
 *   2. Tanggal periksa 2030 diterima dan seluruh hasil serta red flag tampil.
 *      Atribut `max` pada medan tanggal hanya membatasi pemilih kalender;
 *      tanggal yang DIKETIK tetap lolos.
 *   3. Tanggal lahir sesudah tanggal periksa tampil sebagai umur
 *      "11 Bln 20 Hr (-10 Hari)".
 *
 * Fungsi di sini murni dan tidak pernah melempar, sehingga aman dipanggil
 * pada setiap ketukan. Hasilnya `null` bila tanggal dapat dipakai, atau satu
 * kalimat yang langsung dapat ditampilkan kepada petugas.
 * ==========================================================================
 */
import { selisihHari, tanggalValid } from '@/lib/zscore/umur'

export type MasukanTanggalSkrining = {
  tanggalLahir: string
  tanggalPeriksa: string
  /** Tanggal hari ini (YYYY-MM-DD) menurut perangkat. Kosong berarti belum diketahui. */
  hariIni: string
}

export function periksaTanggalSkrining({
  tanggalLahir,
  tanggalPeriksa,
  hariIni,
}: MasukanTanggalSkrining): string | null {
  if (!tanggalLahir) return 'Tanggal lahir belum diisi.'
  if (!tanggalValid(tanggalLahir)) {
    return 'Tanggal lahir belum lengkap atau tidak masuk akal. Periksa kembali tahunnya.'
  }
  if (!tanggalPeriksa) return 'Tanggal periksa belum diisi.'
  if (!tanggalValid(tanggalPeriksa)) {
    return 'Tanggal periksa belum lengkap atau tidak masuk akal. Periksa kembali tahunnya.'
  }
  if (tanggalValid(hariIni) && selisihHari(hariIni, tanggalPeriksa) > 0) {
    return 'Tanggal periksa tidak boleh melewati hari ini.'
  }
  if (selisihHari(tanggalLahir, tanggalPeriksa) < 0) {
    return 'Tanggal lahir tidak boleh sesudah tanggal periksa.'
  }
  return null
}

export type MasukanTanggalSebelumnya = {
  tanggalSebelumnya: string
  tanggalLahir: string
  tanggalPeriksa: string
}

/**
 * Pemeriksaan tanggal penimbangan sebelumnya untuk evaluasi kenaikan berat.
 * Dipanggil hanya bila tanggal lahir dan tanggal periksa sudah sah.
 */
export function periksaTanggalSebelumnya({
  tanggalSebelumnya,
  tanggalLahir,
  tanggalPeriksa,
}: MasukanTanggalSebelumnya): string | null {
  if (!tanggalSebelumnya) return 'Tanggal penimbangan sebelumnya belum diisi.'
  if (!tanggalValid(tanggalSebelumnya)) {
    return 'Tanggal penimbangan sebelumnya belum lengkap atau tidak masuk akal.'
  }
  if (selisihHari(tanggalLahir, tanggalSebelumnya) < 0) {
    return 'Tanggal penimbangan sebelumnya tidak boleh sebelum tanggal lahir.'
  }
  if (selisihHari(tanggalSebelumnya, tanggalPeriksa) <= 0) {
    return 'Tanggal penimbangan sebelumnya harus sebelum tanggal periksa.'
  }
  return null
}

/**
 * Teks umur kalender, misalnya "1 Thn 2 Bln 3 Hr (428 Hari)".
 *
 * Bila tanggal awal sesudah tanggal akhir, yang terjadi pada usia koreksi bayi
 * prematur yang belum mencapai umur cukup bulan, hasilnya bukan umur negatif
 * seperti "10 Bln 7 Hr (-54 Hari)", melainkan kalimat yang menyatakannya.
 */
export function formatUmurKalender(tanggalAwal: string, tanggalAkhir: string): string {
  if (!tanggalValid(tanggalAwal) || !tanggalValid(tanggalAkhir)) return '—'
  const totalHari = selisihHari(tanggalAwal, tanggalAkhir)
  if (totalHari < 0) {
    return `Belum cukup bulan (kurang ${-totalHari} hari menuju 40 minggu)`
  }

  // Bulan penuh dihitung dengan menambahkan bulan ke tanggal awal, dijepit ke
  // akhir bulan (31 Januari + 1 bulan = 28 Februari). Cara "pinjam hari dari
  // bulan sebelumnya" yang lama menghasilkan "1 Bln -2 Hr" untuk 31 Januari
  // sampai 1 Maret.
  const [y1, m1, d1] = tanggalAwal.split('-').map(Number) as [number, number, number]
  const [y2, m2, d2] = tanggalAkhir.split('-').map(Number) as [number, number, number]
  let bulanPenuh = (y2 - y1) * 12 + (m2 - m1)
  if (d2 < d1) bulanPenuh--
  const tahunJangkar = y1 + Math.floor((m1 - 1 + bulanPenuh) / 12)
  const bulanJangkar = ((m1 - 1 + bulanPenuh) % 12) + 1
  const hariMaks = new Date(Date.UTC(tahunJangkar, bulanJangkar, 0)).getUTCDate()
  const dua = (n: number) => String(n).padStart(2, '0')
  const jangkar = `${tahunJangkar}-${dua(bulanJangkar)}-${dua(Math.min(d1, hariMaks))}`
  const d = selisihHari(jangkar, tanggalAkhir)
  const y = Math.floor(bulanPenuh / 12)
  const m = bulanPenuh % 12
  const bagian: string[] = []
  if (y > 0) bagian.push(`${y} Thn`)
  if (m > 0 || y > 0) bagian.push(`${m} Bln`)
  bagian.push(`${d} Hr`)
  return `${bagian.join(' ')} (${totalHari} Hari)`
}
