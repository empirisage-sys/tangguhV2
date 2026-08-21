/**
 * Mesin LMS: interpolasi parameter dan perhitungan Z-Score.
 *
 * Berkas ini memuat matematika inti aplikasi. Setiap perubahan di sini
 * mengubah hasil diagnosis seluruh sistem.
 *
 * Yang DIPERTAHANKAN dari aplikasi versi Firebase, dan tidak boleh diubah:
 *   - Interpolasi linear pada L, M, dan S secara terpisah.
 *   - Ambang `Math.abs(L) < 0.01` untuk beralih ke rumus logaritmik.
 *   - Koreksi WHO untuk |Z| > 3 memakai jarak antara SD3 dan SD2.
 *
 * Yang DIUBAH secara sengaja (lihat TELAAH_KODE_LAMA_TANGGUH.md temuan T-3):
 *   - Nilai di luar rentang tabel TIDAK LAGI dijepit ke baris tepi. Fungsi
 *     `interpolasiLms` mengembalikan `null` dan menandai `diLuarRentang`.
 *     Penjepitan hanya tersedia pada `lmsUntukKurva`, yang dipakai khusus
 *     untuk menggambar garis kurva agar tidak terputus, bukan untuk diagnosis.
 */
import type { Lms, TabelLms } from '@/lib/who'

/** Toleransi perbandingan bilangan pecahan. */
const EPS = 1e-9

type BatasTabel = { min: number; maks: number }

const cacheBatas = new WeakMap<object, BatasTabel>()

/** Mencari nilai x terkecil dan terbesar pada sebuah tabel, dengan hasil di-cache. */
export function batasTabel(tabel: TabelLms): BatasTabel {
  const tersimpan = cacheBatas.get(tabel as object)
  if (tersimpan) return tersimpan

  let min = Number.POSITIVE_INFINITY
  let maks = Number.NEGATIVE_INFINITY
  for (const kunci of Object.keys(tabel)) {
    const x = Number(kunci)
    if (x < min) min = x
    if (x > maks) maks = x
  }

  const batas = { min, maks }
  cacheBatas.set(tabel as object, batas)
  return batas
}

export type HasilInterpolasi = {
  lms: Lms | null
  diLuarRentang: boolean
}

/** Interpolasi linear satu dimensi. */
function lerp(x: number, x1: number, y1: number, x2: number, y2: number): number {
  if (Math.abs(x2 - x1) < EPS) return y1
  return y1 + ((x - x1) * (y2 - y1)) / (x2 - x1)
}

/** Membulatkan kunci agar cocok dengan kunci objek tabel, misalnya 78.5 dan bukan 78.50000000001. */
function kunci(nilai: number): number {
  return Math.round(nilai * 1e6) / 1e6
}

/**
 * Mengambil L, M, dan S untuk nilai x tertentu, dengan interpolasi linear
 * bila x berada di antara dua baris tabel.
 *
 * Mengembalikan `lms: null` bila x berada di luar rentang tabel.
 */
export function interpolasiLms(x: number, tabel: TabelLms, langkah: number): HasilInterpolasi {
  if (!Number.isFinite(x)) return { lms: null, diLuarRentang: true }

  const { min, maks } = batasTabel(tabel)
  if (x < min - EPS || x > maks + EPS) {
    return { lms: null, diLuarRentang: true }
  }

  const lantai = kunci(Math.floor((x + EPS) / langkah) * langkah)
  const atap = kunci(lantai + langkah)

  const lmsLantai = tabel[lantai]
  const lmsAtap = tabel[atap]

  // Nilai x jatuh tepat pada satu baris tabel.
  if (lmsLantai && Math.abs(x - lantai) < 1e-6) {
    return { lms: lmsLantai, diLuarRentang: false }
  }

  // x berada pada baris terakhir tabel dan tidak ada baris berikutnya.
  if (lmsLantai && !lmsAtap) {
    return { lms: lmsLantai, diLuarRentang: false }
  }

  if (!lmsLantai || !lmsAtap) {
    // Tabel tidak lengkap pada rentang ini. Tidak boleh menebak.
    return { lms: null, diLuarRentang: true }
  }

  const L = lerp(x, lantai, lmsLantai[0], atap, lmsAtap[0])
  const M = lerp(x, lantai, lmsLantai[1], atap, lmsAtap[1])
  const S = lerp(x, lantai, lmsLantai[2], atap, lmsAtap[2])

  return { lms: [L, M, S] as Lms, diLuarRentang: false }
}

/**
 * Versi interpolasi yang MENJEPIT nilai x ke tepi tabel.
 *
 * HANYA untuk menggambar garis kurva pertumbuhan. Jangan pernah dipakai
 * untuk menetapkan status gizi: menjepit nilai di luar rentang menghasilkan
 * Z-Score yang tampak wajar tetapi tidak sahih.
 */
export function lmsUntukKurva(x: number, tabel: TabelLms, langkah: number): Lms | null {
  const { min, maks } = batasTabel(tabel)
  const xJepit = Math.min(Math.max(x, min), maks)
  return interpolasiLms(xJepit, tabel, langkah).lms
}

/**
 * Menghitung nilai pengukuran pada Z tertentu (kebalikan dari Z-Score).
 * Dipakai untuk menggambar garis rujukan kurva dan untuk koreksi nilai ekstrem.
 */
export function nilaiDariLms(lms: Lms, z: number): number {
  const [L, M, S] = lms
  if (Math.abs(L) < 0.01) return M * Math.exp(S * z)

  const basis = 1 + L * S * z
  if (basis <= 0) return 0
  return M * Math.pow(basis, 1 / L)
}

/**
 * Menghitung Z-Score dengan metode LMS, dilengkapi koreksi WHO untuk nilai ekstrem.
 *
 * Koreksi untuk |Z| > 3 mengikuti WHO Anthro: di luar 3 SD, distribusi LMS
 * tidak lagi menggambarkan sebaran nyata, sehingga jarak diukur secara linear
 * memakai selisih antara SD3 dan SD2. Tanpa koreksi ini, kasus gizi buruk berat
 * akan terlaporkan dengan nilai Z yang meleset jauh.
 *
 * Catatan: koreksi ini juga dijalankan pada TB/U. Secara matematis tidak
 * berdampak karena seluruh nilai L pada tabel TB/U sama dengan 1, sehingga
 * distribusinya normal dan hasil ekstrapolasi identik dengan rumus LMS biasa.
 * Sudah diverifikasi lewat uji di berkas __tests__/lms.test.ts.
 */
export function hitungZ(nilai: number, lms: Lms | null): number | null {
  if (!lms) return null
  if (!Number.isFinite(nilai) || nilai <= 0) return null

  const [L, M, S] = lms
  if (M <= 0 || S <= 0) return null

  let z: number
  if (Math.abs(L) < 0.01) {
    z = Math.log(nilai / M) / S
  } else {
    z = (Math.pow(nilai / M, L) - 1) / (L * S)
  }

  if (!Number.isFinite(z)) return null

  if (z > 3) {
    const sd3 = nilaiDariLms(lms, 3)
    const sd2 = nilaiDariLms(lms, 2)
    const jarak = sd3 - sd2
    if (jarak === 0) return z
    return 3 + (nilai - sd3) / jarak
  }

  if (z < -3) {
    const sd3 = nilaiDariLms(lms, -3)
    const sd2 = nilaiDariLms(lms, -2)
    const jarak = sd2 - sd3
    if (jarak === 0) return z
    return -3 + (nilai - sd3) / jarak
  }

  return z
}

/** Membulatkan nilai Z ke tiga desimal untuk disimpan ke database. */
export function bulatkanZ(z: number | null): number | null {
  if (z === null) return null
  return Math.round(z * 1000) / 1000
}
