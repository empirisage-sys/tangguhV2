/**
 * Pita Z-Score — elemen penanda visual Aplikasi TANGGUH.
 *
 * Bentuknya pita horizontal bergaya garis ukur meteran antropometri, dengan
 * penanda posisi anak di antara -3 dan +3 SD. Motifnya sengaja diambil dari
 * alat ukur yang dipakai kader sendiri, bukan dari ornamen yang tidak ada
 * hubungannya dengan pekerjaan mereka.
 *
 * Berkas ini hanya memuat perhitungan posisi. Tidak ada React, tidak ada CSS,
 * sehingga dapat diuji langsung.
 */
import type { NadaKlinis } from './status'

/** Batas pita. Nilai di luar rentang ini ditampilkan sebagai panah di ujung. */
export const Z_MIN = -4
export const Z_MAKS = 4

/**
 * Titik yang diberi angka pada pita.
 *
 * Dipertahankan untuk pemanggil lama. Pakai `titikLabelUntuk()` agar setiap
 * batas warna benar-benar berangka.
 */
export const TITIK_LABEL = [-3, -2, 0, 2, 3] as const

/**
 * Angka penunjuk skala untuk satu indikator.
 *
 * ==========================================================================
 * TEMUAN AUDIT P-1: BATAS WARNA YANG TIDAK BERANGKA
 *
 * Satu daftar label dipakai untuk ketiga indikator: -3, -2, 0, +2, +3. Padahal
 * batas warnanya berbeda-beda. Pada BB/U dan BB/TB, pita berubah dari hijau ke
 * kuning tepat di +1 SD — dan +1 TIDAK ADA pada daftar label, sementara +2 yang
 * berangka justru berada di TENGAH pita kuning BB/U.
 *
 * Akibatnya kader membaca pita berwarna tanpa dapat mengetahui di angka berapa
 * "risiko berat badan lebih" dimulai. Pita ini satu-satunya elemen yang boleh
 * menonjol secara visual di aplikasi ini; batas yang tidak berangka membuatnya
 * indah tetapi tidak terbaca.
 *
 * Sekarang setiap batas segmen berangka, dan hanya batas yang memang berlaku
 * untuk indikator itu yang ditampilkan.
 * ==========================================================================
 */
export function titikLabelUntuk(indikator: 'bbu' | 'tbu' | 'bbtb'): number[] {
  const batas = new Set<number>([0])
  for (const s of segmenUntuk(indikator)) {
    const z = persenKeZ(s.dariPersen)
    // Tepi pita tidak diberi angka: yang bermakna adalah batas klinisnya.
    if (z > Z_MIN + 1e-9 && z < Z_MAKS - 1e-9) batas.add(z)
  }
  return [...batas].sort((a, b) => a - b)
}

export type SegmenPita = {
  /** Batas kiri dan kanan segmen dalam satuan persen lebar pita. */
  dariPersen: number
  sampaiPersen: number
  nada: NadaKlinis
  /** Keterangan singkat untuk pembaca layar. */
  keterangan: string
}

export type PosisiPenanda = {
  /** Posisi penanda dalam persen lebar pita, sudah dijepit ke 0-100. */
  persen: number
  /** true bila nilai Z sebenarnya berada di luar batas pita. */
  diLuarPita: boolean
  /** Arah panah bila di luar pita. */
  arah: 'kiri' | 'kanan' | null
}

/** Mengubah nilai Z menjadi posisi persen pada pita. */
export function zKePersen(z: number): number {
  const p = ((z - Z_MIN) / (Z_MAKS - Z_MIN)) * 100
  return Math.min(100, Math.max(0, p))
}

/** Kebalikan `zKePersen`, untuk menurunkan angka label dari batas segmen. */
export function persenKeZ(persen: number): number {
  const z = (persen / 100) * (Z_MAKS - Z_MIN) + Z_MIN
  return Math.round(z * 100) / 100
}

export function posisiPenanda(z: number | null): PosisiPenanda | null {
  if (z === null || !Number.isFinite(z)) return null

  return {
    persen: zKePersen(z),
    diLuarPita: z < Z_MIN || z > Z_MAKS,
    arah: z < Z_MIN ? 'kiri' : z > Z_MAKS ? 'kanan' : null,
  }
}

/**
 * Menyusun segmen warna pita untuk indikator berat badan menurut panjang
 * atau tinggi badan. Ambangnya mengikuti standar Kemenkes.
 */
export function segmenBBTB(): SegmenPita[] {
  return [
    { dariPersen: zKePersen(Z_MIN), sampaiPersen: zKePersen(-3), nada: 'bahaya', keterangan: 'Gizi buruk' },
    { dariPersen: zKePersen(-3), sampaiPersen: zKePersen(-2), nada: 'waspada', keterangan: 'Gizi kurang' },
    { dariPersen: zKePersen(-2), sampaiPersen: zKePersen(1), nada: 'aman', keterangan: 'Gizi baik' },
    { dariPersen: zKePersen(1), sampaiPersen: zKePersen(3), nada: 'waspada', keterangan: 'Risiko gizi lebih sampai gizi lebih' },
    { dariPersen: zKePersen(3), sampaiPersen: zKePersen(Z_MAKS), nada: 'bahaya', keterangan: 'Obesitas' },
  ]
}

/** Segmen pita untuk panjang atau tinggi badan menurut umur. */
export function segmenTBU(): SegmenPita[] {
  return [
    { dariPersen: zKePersen(Z_MIN), sampaiPersen: zKePersen(-3), nada: 'bahaya', keterangan: 'Sangat pendek' },
    { dariPersen: zKePersen(-3), sampaiPersen: zKePersen(-2), nada: 'waspada', keterangan: 'Pendek' },
    { dariPersen: zKePersen(-2), sampaiPersen: zKePersen(3), nada: 'aman', keterangan: 'Normal' },
    { dariPersen: zKePersen(3), sampaiPersen: zKePersen(Z_MAKS), nada: 'netral', keterangan: 'Tinggi' },
  ]
}

/** Segmen pita untuk berat badan menurut umur. */
export function segmenBBU(): SegmenPita[] {
  return [
    { dariPersen: zKePersen(Z_MIN), sampaiPersen: zKePersen(-3), nada: 'bahaya', keterangan: 'Berat badan sangat kurang' },
    { dariPersen: zKePersen(-3), sampaiPersen: zKePersen(-2), nada: 'waspada', keterangan: 'Berat badan kurang' },
    { dariPersen: zKePersen(-2), sampaiPersen: zKePersen(1), nada: 'aman', keterangan: 'Berat badan normal' },
    { dariPersen: zKePersen(1), sampaiPersen: zKePersen(Z_MAKS), nada: 'waspada', keterangan: 'Risiko berat badan lebih' },
  ]
}

export function segmenUntuk(indikator: 'bbu' | 'tbu' | 'bbtb'): SegmenPita[] {
  if (indikator === 'bbu') return segmenBBU()
  if (indikator === 'tbu') return segmenTBU()
  return segmenBBTB()
}

/** Posisi garis-garis ukur kecil pada pita, satu tiap 0,5 SD. */
export function garisUkur(): Array<{ persen: number; besar: boolean }> {
  const garis: Array<{ persen: number; besar: boolean }> = []
  for (let z = Z_MIN; z <= Z_MAKS + 1e-9; z += 0.5) {
    const bulat = Math.round(z * 2) / 2
    garis.push({ persen: zKePersen(bulat), besar: Number.isInteger(bulat) })
  }
  return garis
}
