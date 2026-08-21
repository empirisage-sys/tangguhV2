/**
 * ENGINE LAMA — SALINAN PERILAKU APLIKASI VERSI FIREBASE
 *
 * Berkas ini BUKAN bagian aplikasi. Ia hanya dipakai oleh uji regresi untuk
 * membuktikan bahwa setiap perbedaan hasil antara engine baru dan engine lama
 * memang berasal dari enam perubahan yang disengaja, bukan dari kekeliruan
 * pemindahan.
 *
 * Isi berkas ini adalah pemindahan harfiah dari:
 *   - zScoreUtils.ts  (calculateZScore, interpolateLms, adjustHeightForPosition,
 *                      getLmsForWeightForHeight, calculateWeightTrend, getStatusGizi*)
 *   - App.tsx baris 88-102 dan 930-1040 (getRdaValue, findMedianAgeForHeight,
 *                      perhitungan kalori dan protein)
 *
 * JANGAN memperbaiki apa pun di berkas ini, termasuk hal yang sudah diketahui
 * keliru. Nilainya justru terletak pada kesetiaannya terhadap perilaku lama.
 *
 * Tabel L, M, S yang dipakai adalah tabel yang sama dengan engine baru. Ini
 * sah karena seluruh 114 baris tabel velocity dan seluruh tabel LMS sudah
 * diverifikasi sama persis dengan nilai di constants.ts aplikasi lama.
 */
import {
  LANGKAH_PANJANG_CM,
  LANGKAH_UMUR_BULAN,
  tabelPanjang,
  tabelUmur,
  tabelVelocity,
} from '@/lib/who'
import type { JenisKelamin, Lms, TabelLms } from '@/lib/who'
import { batasTabel } from '@/lib/zscore/lms'

const HARI_PER_BULAN = 30.4375

// ---------------------------------------------------------------------------
// zScoreUtils.ts — calculatePreciseAgeInMonths
// ---------------------------------------------------------------------------
export function umurBulanLama(tglLahir: string, tglPeriksa: string): number {
  const d1 = new Date(tglLahir)
  const d2 = new Date(tglPeriksa)
  const diffHari = (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)
  return Math.max(0, diffHari / HARI_PER_BULAN)
}

// ---------------------------------------------------------------------------
// zScoreUtils.ts — interpolateLms
// Perhatikan perilaku menjepit ke tepi tabel ketika nilai di luar rentang.
// ---------------------------------------------------------------------------
function lerp(x: number, x1: number, y1: number, x2: number, y2: number): number {
  if (Math.abs(x2 - x1) < 1e-9) return y1
  return y1 + ((x - x1) * (y2 - y1)) / (x2 - x1)
}

export function interpolasiLmsLama(
  nilai: number,
  tabel: TabelLms,
  langkah: number,
): Lms | null {
  const lantai = Math.round((Math.floor(nilai / langkah) * langkah) * 1e6) / 1e6
  const atap = Math.round((lantai + langkah) * 1e6) / 1e6

  const lmsLantai = tabel[lantai]
  const lmsAtap = tabel[atap]

  if (Math.abs(nilai - lantai) < 1e-5 && lmsLantai) return lmsLantai
  if (lmsLantai && !lmsAtap) return lmsLantai
  if (!lmsLantai && lmsAtap) return lmsAtap

  if (!lmsLantai && !lmsAtap) {
    const { min, maks } = batasTabel(tabel)
    if (nilai < min) return tabel[min] ?? null
    if (nilai > maks) return tabel[maks] ?? null
    return null
  }

  const [L1, M1, S1] = lmsLantai as Lms
  const [L2, M2, S2] = lmsAtap as Lms
  return [
    lerp(nilai, lantai, L1, atap, L2),
    lerp(nilai, lantai, M1, atap, M2),
    lerp(nilai, lantai, S1, atap, S2),
  ] as Lms
}

// ---------------------------------------------------------------------------
// zScoreUtils.ts — calculateFromLms & calculateZScore
// ---------------------------------------------------------------------------
export function nilaiDariLmsLama(lms: Lms, z: number): number {
  const [L, M, S] = lms
  if (Math.abs(L) < 0.01) return M * Math.exp(S * z)
  const basis = 1 + L * S * z
  if (basis <= 0) return 0
  return M * Math.pow(basis, 1 / L)
}

export function hitungZLama(nilai: number, lms: Lms | null): number | null {
  if (!lms || lms.length !== 3) return null
  const [L, M, S] = lms
  if (M <= 0 || S <= 0) return null

  let z: number
  if (Math.abs(L) < 0.01) z = Math.log(nilai / M) / S
  else z = (Math.pow(nilai / M, L) - 1) / (L * S)

  if (z > 3) {
    const sd3 = nilaiDariLmsLama(lms, 3)
    const sd2 = nilaiDariLmsLama(lms, 2)
    const d = sd3 - sd2
    if (d === 0) return z
    return 3 + (nilai - sd3) / d
  }
  if (z < -3) {
    const sd3 = nilaiDariLmsLama(lms, -3)
    const sd2 = nilaiDariLmsLama(lms, -2)
    const d = sd2 - sd3
    if (d === 0) return z
    return -3 + (nilai - sd3) / d
  }
  return z
}

// ---------------------------------------------------------------------------
// zScoreUtils.ts — adjustHeightForPosition & getLmsForWeightForHeight
// ---------------------------------------------------------------------------
export function koreksiPosisiLama(
  terukur: number,
  umurBulan: number,
  posisi: 'recumbent' | 'standing' | 'auto',
): { nilai: number; standarTerlentang: boolean } {
  const standarTerlentang = umurBulan < 24
  let nilai = terukur
  if (posisi === 'recumbent' && !standarTerlentang) nilai = terukur - 0.7
  else if (posisi === 'standing' && standarTerlentang) nilai = terukur + 0.7
  return { nilai, standarTerlentang }
}

export function lmsBBTBLama(
  seks: JenisKelamin,
  terukur: number,
  umurBulan: number,
  posisi: 'recumbent' | 'standing' | 'auto',
): { lms: Lms | null; tabelDipakai: 'BB/PB' | 'BB/TB' } {
  const { nilai, standarTerlentang } = koreksiPosisiLama(terukur, umurBulan, posisi)
  let pakaiWfl = standarTerlentang
  if (pakaiWfl) {
    if (nilai > 110) pakaiWfl = false
  } else if (nilai < 65) {
    pakaiWfl = true
  }
  const tabel = tabelPanjang(pakaiWfl ? 'bbpb' : 'bbtb', seks)
  return {
    lms: interpolasiLmsLama(nilai, tabel, LANGKAH_PANJANG_CM),
    tabelDipakai: pakaiWfl ? 'BB/PB' : 'BB/TB',
  }
}

// ---------------------------------------------------------------------------
// zScoreUtils.ts — getStatusGizi*
// Perhatikan ambang TB/U: Z > 2 sudah disebut "Tinggi".
// ---------------------------------------------------------------------------
export function statusTBULama(z: number): string {
  if (z < -3) return 'Sangat Pendek'
  if (z < -2) return 'Pendek'
  if (z > 3) return 'Sangat Tinggi'
  if (z > 2) return 'Tinggi'
  return 'Normal'
}

export function statusBBULama(z: number): string {
  if (z < -3) return 'Berat Badan Sangat Kurang'
  if (z < -2) return 'Berat Badan Kurang'
  if (z > 1) return 'Risiko Gizi Lebih'
  return 'Berat Badan Normal'
}

export function statusBBTBLama(z: number): string {
  if (z > 3) return 'Obesitas'
  if (z > 2) return 'Gizi Lebih'
  if (z > 1) return 'Risiko Gizi Lebih'
  if (z < -3) return 'Gizi Buruk'
  if (z < -2) return 'Gizi Kurang'
  return 'Gizi Baik'
}

// ---------------------------------------------------------------------------
// App.tsx — getRdaValue, findMedianAgeForHeight, perhitungan gizi
// ---------------------------------------------------------------------------
export function rdaLama(umurBulan: number): number {
  const umurTahun = umurBulan / 12
  if (umurBulan <= 12) return 110
  if (umurTahun <= 3) return 100
  if (umurTahun <= 6) return 90
  return 90
}

/** Memindai seluruh baris dan mengambil bulan dengan median terdekat. Hasilnya bilangan bulat. */
export function usiaTinggiLama(seks: JenisKelamin, tinggi: number): number {
  const tabel = tabelUmur('tbu', seks)
  let bulanTerdekat = 0
  let selisihTerkecil = Number.POSITIVE_INFINITY
  for (const kunci of Object.keys(tabel)) {
    const bulan = Number(kunci)
    const lms = tabel[bulan]
    if (!lms) continue
    const selisih = Math.abs(lms[1] - tinggi)
    if (selisih < selisihTerkecil) {
      selisihTerkecil = selisih
      bulanTerdekat = bulan
    }
  }
  return bulanTerdekat
}

export type HasilGiziLama = {
  kaloriTotal: number
  proteinMin: number
  proteinMaks: number
  beratIdealKg: number
  usiaTinggiBulan: number
}

export function hitungGiziLama(
  seks: JenisKelamin,
  umurBulan: number,
  beratKg: number,
  tinggiTerukur: number,
  lmsBbtb: Lms | null,
): HasilGiziLama {
  const rda = rdaLama(umurBulan)
  return {
    kaloriTotal: Math.round(rda * beratKg),
    proteinMin: Math.round(1.2 * beratKg * 10) / 10,
    proteinMaks: Math.round(1.5 * beratKg * 10) / 10,
    beratIdealKg: lmsBbtb ? lmsBbtb[1] : 0,
    usiaTinggiBulan: usiaTinggiLama(seks, tinggiTerukur),
  }
}

// ---------------------------------------------------------------------------
// zScoreUtils.ts — calculateWeightTrend
// Perhatikan: tidak ada pengurangan delta, dan penskalaan linear tanpa batas.
// ---------------------------------------------------------------------------
export type HasilVelocityLama = {
  selisihHari: number
  kenaikanAktual: number
  kenaikanMinimal: number
  isFaltering: boolean
  metode: string
}

export function hitungVelocityLama(
  tglLahir: string,
  tglLalu: string,
  beratLalu: number,
  tglPeriksa: string,
  beratSekarang: number,
  seks: JenisKelamin,
): HasilVelocityLama | null {
  const dLahir = new Date(tglLahir).getTime()
  const dLalu = new Date(tglLalu).getTime()
  const dPeriksa = new Date(tglPeriksa).getTime()
  if (dLalu <= dLahir || dPeriksa <= dLalu) return null

  const msHari = 1000 * 60 * 60 * 24
  const selisihHari = (dPeriksa - dLalu) / msHari
  if (selisihHari <= 0) return null

  const kenaikanAktual = (beratSekarang - beratLalu) * 1000
  const umurBulan = (dLalu - dLahir) / msHari / HARI_PER_BULAN

  let kenaikanMinimal = 0
  let metode = ''

  if (umurBulan < 24) {
    let interval: '1bln' | '2bln' | '3bln' = '1bln'
    if (selisihHari >= 46 && selisihHari < 76) interval = '2bln'
    if (selisihHari >= 76) interval = '3bln'

    const tabel = tabelVelocity(interval, seks)
    const lms = tabel.baris[Math.floor(umurBulan)]

    if (lms) {
      // Tidak ada pengurangan delta di sini. Inilah temuan K-3.
      const p5 = nilaiDariLmsLama(lms, -1.645)
      const hariStandar =
        interval === '1bln' ? 30.4375 : interval === '2bln' ? 60.875 : 91.3125
      kenaikanMinimal = Math.round((p5 / hariStandar) * selisihHari)
      metode = `WHO Weight Velocity (${interval}) < P5`
    } else {
      for (let i = 0; i < selisihHari; i += 1) kenaikanMinimal += 20
      metode = 'Approximation (Data Missing)'
    }
  } else {
    const laju = [
      { sampai: 3, g: 30 },
      { sampai: 6, g: 20 },
      { sampai: 9, g: 15 },
      { sampai: 12, g: 12 },
      { sampai: 36, g: 8 },
      { sampai: 72, g: 6 },
    ]
    let waktu = dLalu
    for (let i = 0; i < selisihHari; i += 1) {
      const umurSaatItu = (waktu - dLahir) / msHari / HARI_PER_BULAN
      const baris = laju.find((r) => umurSaatItu <= r.sampai)
      kenaikanMinimal += baris ? baris.g : 6
      waktu += msHari
    }
    metode = 'KBM (Approximation for > 2y)'
  }

  return {
    selisihHari: Math.round(selisihHari),
    kenaikanAktual: Math.round(kenaikanAktual),
    kenaikanMinimal: Math.round(kenaikanMinimal),
    isFaltering: kenaikanAktual < kenaikanMinimal,
    metode,
  }
}

/** Menghitung satu kasus lengkap dengan perilaku lama, untuk dibandingkan. */
export function hitungSkriningLama(input: {
  tanggalLahir: string
  tanggalPeriksa: string
  jenisKelamin: JenisKelamin
  beratKg: number
  panjangCm: number
  posisiUkur: 'recumbent' | 'standing' | 'auto'
}) {
  const umurBulan = umurBulanLama(input.tanggalLahir, input.tanggalPeriksa)
  const lmsBbu = interpolasiLmsLama(
    umurBulan,
    tabelUmur('bbu', input.jenisKelamin),
    LANGKAH_UMUR_BULAN,
  )
  const lmsTbu = interpolasiLmsLama(
    umurBulan,
    tabelUmur('tbu', input.jenisKelamin),
    LANGKAH_UMUR_BULAN,
  )
  const { nilai: panjangTerkoreksi } = koreksiPosisiLama(
    input.panjangCm,
    umurBulan,
    input.posisiUkur,
  )
  const { lms: lmsBbtb, tabelDipakai } = lmsBBTBLama(
    input.jenisKelamin,
    input.panjangCm,
    umurBulan,
    input.posisiUkur,
  )

  const zBbu = hitungZLama(input.beratKg, lmsBbu)
  const zTbu = hitungZLama(panjangTerkoreksi, lmsTbu)
  const zBbtb = hitungZLama(input.beratKg, lmsBbtb)

  return {
    umurBulan,
    panjangTerkoreksi,
    tabelDipakai,
    zBbu,
    zTbu,
    zBbtb,
    statusBbu: zBbu === null ? null : statusBBULama(zBbu),
    statusTbu: zTbu === null ? null : statusTBULama(zTbu),
    statusBbtb: zBbtb === null ? null : statusBBTBLama(zBbtb),
    gizi: hitungGiziLama(
      input.jenisKelamin,
      umurBulan,
      input.beratKg,
      input.panjangCm,
      lmsBbtb,
    ),
  }
}
