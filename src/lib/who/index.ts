/**
 * Titik masuk tunggal untuk seluruh tabel referensi WHO.
 *
 * Berkas di folder ini dihasilkan otomatis dan TIDAK BOLEH diedit manual.
 * Setiap perubahan nilai L, M, atau S mengubah hasil diagnosis seluruh
 * aplikasi. Bila tabel perlu diperbarui, perbarui skrip penghasilnya dan
 * jalankan ulang uji regresi.
 */
import type { JenisKelamin, IntervalVelocity, Lms, TabelLms, TabelVelocity } from './tipe'
import { lmsBBULk } from './lms-bbu-lk'
import { lmsBBUPr } from './lms-bbu-pr'
import { lmsTBULk } from './lms-tbu-lk'
import { lmsTBUPr } from './lms-tbu-pr'
import { lmsBBPBLk } from './lms-bbpb-lk'
import { lmsBBPBPr } from './lms-bbpb-pr'
import { lmsBBTBLk } from './lms-bbtb-lk'
import { lmsBBTBPr } from './lms-bbtb-pr'
import { lmsHarianBBULk } from './lms-harian-bbu-lk'
import { lmsHarianBBUPr } from './lms-harian-bbu-pr'
import { lmsHarianTBULk } from './lms-harian-tbu-lk'
import { lmsHarianTBUPr } from './lms-harian-tbu-pr'
import {
  velocity1BlnLk, velocity2BlnLk, velocity3BlnLk,
  velocity1BlnPr, velocity2BlnPr, velocity3BlnPr,
} from './velocity'

export type { Lms, TabelLms, TabelVelocity, JenisKelamin, IntervalVelocity } from './tipe'

/** Indikator yang memakai umur sebagai sumbu x. */
export type IndikatorUmur = 'bbu' | 'tbu'
/** Indikator yang memakai panjang atau tinggi badan sebagai sumbu x. */
export type IndikatorPanjang = 'bbpb' | 'bbtb'

const TABEL_UMUR: Record<IndikatorUmur, Record<JenisKelamin, TabelLms>> = {
  bbu: { lk: lmsBBULk, pr: lmsBBUPr },
  tbu: { lk: lmsTBULk, pr: lmsTBUPr },
}

/**
 * Tabel harian WHO (expanded tables) untuk indikator berbasis umur. Indeks
 * senarai adalah umur dalam hari, 0 sampai 1856.
 *
 * Dipakai mesin sejak zscore-2.3.0 karena interpolasi lurus antarbaris bulanan
 * meleset sampai 0,27 SD pada minggu-minggu pertama dan sampai 0,23 SD pada
 * umur 23-24 bulan, tempat baris bulan ke-23 (panjang terlentang) diinterpolasi
 * ke baris bulan ke-24 (tinggi berdiri).
 */
const TABEL_UMUR_HARIAN: Record<IndikatorUmur, Record<JenisKelamin, ReadonlyArray<Lms>>> = {
  bbu: { lk: lmsHarianBBULk, pr: lmsHarianBBUPr },
  tbu: { lk: lmsHarianTBULk, pr: lmsHarianTBUPr },
}

const TABEL_PANJANG: Record<IndikatorPanjang, Record<JenisKelamin, TabelLms>> = {
  bbpb: { lk: lmsBBPBLk, pr: lmsBBPBPr },
  bbtb: { lk: lmsBBTBLk, pr: lmsBBTBPr },
}

const TABEL_VELOCITY: Record<IntervalVelocity, Record<JenisKelamin, TabelVelocity>> = {
  '1bln': { lk: velocity1BlnLk, pr: velocity1BlnPr },
  '2bln': { lk: velocity2BlnLk, pr: velocity2BlnPr },
  '3bln': { lk: velocity3BlnLk, pr: velocity3BlnPr },
}

export function tabelUmur(indikator: IndikatorUmur, seks: JenisKelamin): TabelLms {
  return TABEL_UMUR[indikator][seks]
}

/**
 * LMS WHO pada umur `hari` hari, langsung dari tabel harian. `null` bila umur
 * bukan bilangan bulat dalam rentang 0-1856 hari; nilai tidak pernah dijepit
 * (AGENTS.md 2.5).
 */
export function lmsUmurHarian(
  indikator: IndikatorUmur,
  seks: JenisKelamin,
  hari: number,
): Lms | null {
  if (!Number.isInteger(hari) || hari < 0) return null
  return TABEL_UMUR_HARIAN[indikator][seks][hari] ?? null
}

/** Umur terakhir (hari) yang tercakup tabel harian WHO 0-5 tahun. */
export const UMUR_MAKS_HARI_TABEL = 1856

export function tabelPanjang(indikator: IndikatorPanjang, seks: JenisKelamin): TabelLms {
  return TABEL_PANJANG[indikator][seks]
}

export function tabelVelocity(interval: IntervalVelocity, seks: JenisKelamin): TabelVelocity {
  return TABEL_VELOCITY[interval][seks]
}

/** Langkah antar baris tabel, dipakai oleh fungsi interpolasi. */
export const LANGKAH_UMUR_BULAN = 1
export const LANGKAH_PANJANG_CM = 0.5

/** Batas cakupan standar WHO 0-60 bulan yang dipakai aplikasi ini. */
export const UMUR_MAKS_BULAN = 60
export const UMUR_MAKS_HARI = 1857
