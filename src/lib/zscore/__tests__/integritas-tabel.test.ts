import { describe, expect, it } from 'vitest'
import {
  tabelPanjang,
  tabelUmur,
  type IndikatorPanjang,
  type IndikatorUmur,
  type JenisKelamin,
  type TabelLms,
} from '@/lib/who'

/**
 * UJI INTEGRITAS TABEL REFERENSI WHO
 *
 * Berkas ini menguji sifat-sifat yang HARUS dimiliki tabel WHO, tanpa perlu
 * menuliskan ulang seluruh 728 nilai di dalam uji.
 *
 * Alasan berkas ini ada: pada tabel BB/PB perempuan aplikasi versi Firebase,
 * baris 95,5 cm terisi nilai dari tabel BB/TB perempuan. Kesalahan salin satu
 * baris seperti itu tidak terlihat saat membaca kode, tetapi langsung tertangkap
 * oleh uji monotonisitas di bawah: median berat menurut panjang badan tidak
 * mungkin menurun ketika panjang badan bertambah.
 *
 * Bila suatu hari tabel diperbarui, uji ini yang menjaga agar kesalahan serupa
 * tidak masuk lagi.
 */

const nilai = (t: TabelLms, x: number, i: 0 | 1 | 2): number => {
  const lms = t[x]
  if (!lms) throw new Error(`baris x=${x} tidak ada`)
  return lms[i]
}

const kunci = (t: TabelLms): number[] => Object.keys(t).map(Number).sort((a, b) => a - b)

const TABEL_UMUR: Array<[string, IndikatorUmur, JenisKelamin]> = [
  ['BB/U laki-laki', 'bbu', 'lk'],
  ['BB/U perempuan', 'bbu', 'pr'],
  ['TB/U laki-laki', 'tbu', 'lk'],
  ['TB/U perempuan', 'tbu', 'pr'],
]

const TABEL_PANJANG: Array<[string, IndikatorPanjang, JenisKelamin]> = [
  ['BB/PB laki-laki', 'bbpb', 'lk'],
  ['BB/PB perempuan', 'bbpb', 'pr'],
  ['BB/TB laki-laki', 'bbtb', 'lk'],
  ['BB/TB perempuan', 'bbtb', 'pr'],
]

const SEMUA: Array<[string, TabelLms]> = [
  ...TABEL_UMUR.map(([n, i, s]) => [n, tabelUmur(i, s)] as [string, TabelLms]),
  ...TABEL_PANJANG.map(([n, i, s]) => [n, tabelPanjang(i, s)] as [string, TabelLms]),
]

describe('median harus naik monoton', () => {
  it.each(SEMUA)('%s', (nama, tabel) => {
    const ks = kunci(tabel)
    for (let i = 1; i < ks.length; i += 1) {
      const sebelum = nilai(tabel, ks[i - 1] as number, 1)
      const kini = nilai(tabel, ks[i] as number, 1)
      expect(
        kini,
        `${nama}: median turun dari x=${ks[i - 1]} (${sebelum}) ke x=${ks[i]} (${kini}). ` +
          'Ini pola khas kesalahan salin baris.',
      ).toBeGreaterThan(sebelum)
    }
  })
})

describe('setiap baris harus selaras dengan tetangganya (uji kehalusan lokal)', () => {
  /**
   * Menghitung seberapa jauh median satu baris menyimpang dari titik tengah
   * kedua tetangganya, dibagi setengah jarak antar tetangga. Baris yang
   * tertukar akan menghasilkan rasio besar.
   *
   * Ambang di bawah dikalibrasi dari data nyata:
   *
   *   tabel BB/PB dan BB/TB   rasio tertinggi yang sah 0,022
   *   tabel BB/U              rasio tertinggi yang sah 0,151 (bulan ke-2)
   *   tabel TB/U              rasio tertinggi yang sah 0,672 (bulan ke-23 dan 24,
   *                           yaitu titik peralihan basis panjang ke tinggi)
   *
   *   baris salah salin 95,5 cm pada aplikasi lama menghasilkan rasio 1,403
   */
  function rasioKehalusan(tabel: TabelLms, ks: number[], i: number): number | null {
    const sebelum = nilai(tabel, ks[i - 1] as number, 1)
    const kini = nilai(tabel, ks[i] as number, 1)
    const sesudah = nilai(tabel, ks[i + 1] as number, 1)
    const langkah = (sesudah - sebelum) / 2
    if (langkah <= 0) return null
    return Math.abs(kini - (sebelum + sesudah) / 2) / langkah
  }

  it.each(TABEL_PANJANG)('%s (ambang 0,10)', (nama, indikator, seks) => {
    const tabel = tabelPanjang(indikator, seks)
    const ks = kunci(tabel)
    for (let i = 1; i < ks.length - 1; i += 1) {
      const r = rasioKehalusan(tabel, ks, i)
      if (r === null) continue
      expect(
        r,
        `${nama}: baris x=${ks[i]} menyimpang dari tetangganya, rasio ${r.toFixed(4)}. ` +
          'Ini pola khas baris yang tertukar antar tabel.',
      ).toBeLessThan(0.1)
    }
  })

  it.each(TABEL_UMUR)('%s (ambang 0,25, kecuali peralihan basis di bulan 23 dan 24)', (nama, indikator, seks) => {
    const tabel = tabelUmur(indikator, seks)
    const ks = kunci(tabel)
    for (let i = 1; i < ks.length - 1; i += 1) {
      const x = ks[i] as number
      const r = rasioKehalusan(tabel, ks, i)
      if (r === null) continue

      // Bulan 23 dan 24 memang menyimpang karena tabel WHO berpindah dari
      // basis panjang terlentang ke basis tinggi berdiri di titik itu.
      const ambang = indikator === 'tbu' && (x === 23 || x === 24) ? 0.8 : 0.25

      expect(
        r,
        `${nama}: baris x=${x} menyimpang dari tetangganya, rasio ${r.toFixed(4)}.`,
      ).toBeLessThan(ambang)
    }
  })

  it('uji ini benar-benar akan menangkap baris salah salin', () => {
    // Membuktikan bahwa ambang di atas bukan sekadar longgar: nilai keliru yang
    // pernah ada di aplikasi lama menghasilkan rasio 1,4 dan pasti tertangkap.
    const t = tabelPanjang('bbpb', 'pr')
    const sebelum = nilai(t, 95, 1)
    const sesudah = nilai(t, 96, 1)
    const langkah = (sesudah - sebelum) / 2
    const nilaiKeliru = 14.0186
    const rasioKeliru = Math.abs(nilaiKeliru - (sebelum + sesudah) / 2) / langkah

    expect(rasioKeliru).toBeGreaterThan(1)
    expect(rasioKeliru).toBeGreaterThan(0.1) // melewati ambang tabel panjang
  })
})

describe('parameter S harus berada pada rentang yang wajar', () => {
  it.each(SEMUA)('%s', (nama, tabel) => {
    for (const x of kunci(tabel)) {
      const S = nilai(tabel, x, 2)
      expect(S, `${nama} x=${x}: S = ${S}`).toBeGreaterThan(0.02)
      expect(S, `${nama} x=${x}: S = ${S}`).toBeLessThan(0.2)
    }
  })
})

describe('nilai L sesuai sifat masing-masing indikator', () => {
  it('TB/U bernilai L = 1 pada seluruh baris, sehingga distribusinya normal', () => {
    for (const seks of ['lk', 'pr'] as const) {
      const t = tabelUmur('tbu', seks)
      for (const x of kunci(t)) expect(nilai(t, x, 0)).toBe(1)
    }
  })

  it('BB/PB dan BB/TB bernilai L tetap per jenis kelamin', () => {
    expect(new Set(kunci(tabelPanjang('bbpb', 'lk')).map((x) => nilai(tabelPanjang('bbpb', 'lk'), x, 0)))).toEqual(
      new Set([-0.3521]),
    )
    expect(new Set(kunci(tabelPanjang('bbtb', 'lk')).map((x) => nilai(tabelPanjang('bbtb', 'lk'), x, 0)))).toEqual(
      new Set([-0.3521]),
    )
    expect(new Set(kunci(tabelPanjang('bbpb', 'pr')).map((x) => nilai(tabelPanjang('bbpb', 'pr'), x, 0)))).toEqual(
      new Set([-0.3833]),
    )
    expect(new Set(kunci(tabelPanjang('bbtb', 'pr')).map((x) => nilai(tabelPanjang('bbtb', 'pr'), x, 0)))).toEqual(
      new Set([-0.3833]),
    )
  })
})

describe('tabel BB/PB dan BB/TB tidak boleh saling tertukar barisnya', () => {
  // Kesalahan yang benar-benar terjadi di aplikasi lama: baris 95,5 cm tabel
  // BB/PB perempuan terisi nilai dari tabel BB/TB perempuan.
  it.each([['laki-laki', 'lk'], ['perempuan', 'pr']] as Array<[string, JenisKelamin]>)(
    'tidak ada baris identik antara BB/PB dan BB/TB %s pada rentang tumpang tindih 65-110 cm',
    (_nama, seks) => {
      const bbpb = tabelPanjang('bbpb', seks)
      const bbtb = tabelPanjang('bbtb', seks)

      const identik: number[] = []
      for (const x of kunci(bbpb)) {
        if (x < 65 || x > 110) continue
        if (!bbtb[x]) continue
        if (nilai(bbpb, x, 1) === nilai(bbtb, x, 1) && nilai(bbpb, x, 2) === nilai(bbtb, x, 2)) {
          identik.push(x)
        }
      }

      expect(
        identik,
        `Baris berikut identik antara BB/PB dan BB/TB ${_nama}: ${identik.join(', ')}. ` +
          'Kedua tabel berasal dari populasi rujukan yang berbeda, sehingga nilainya ' +
          'tidak boleh persis sama.',
      ).toHaveLength(0)
    },
  )
})

describe('nilai kunci sesuai tabel terbitan WHO', () => {
  // Titik-titik penanda. Bila salah satu berubah, ada tabel yang tertukar.
  it('BB/U median pada usia kunci', () => {
    expect(nilai(tabelUmur('bbu', 'lk'), 0, 1)).toBeCloseTo(3.3464, 4)
    expect(nilai(tabelUmur('bbu', 'lk'), 24, 1)).toBeCloseTo(12.1515, 4)
    expect(nilai(tabelUmur('bbu', 'lk'), 60, 1)).toBeCloseTo(18.3366, 4)
    expect(nilai(tabelUmur('bbu', 'pr'), 0, 1)).toBeCloseTo(3.2322, 4)
    expect(nilai(tabelUmur('bbu', 'pr'), 24, 1)).toBeCloseTo(11.4775, 4)
    expect(nilai(tabelUmur('bbu', 'pr'), 60, 1)).toBeCloseTo(18.2193, 4)
  })

  it('TB/U median pada titik peralihan basis panjang ke tinggi', () => {
    // Bulan 23 memakai basis panjang terlentang, bulan 24 basis tinggi berdiri.
    expect(nilai(tabelUmur('tbu', 'lk'), 23, 1)).toBeCloseTo(86.941, 3)
    expect(nilai(tabelUmur('tbu', 'lk'), 24, 1)).toBeCloseTo(87.1161, 4)
    expect(nilai(tabelUmur('tbu', 'pr'), 23, 1)).toBeCloseTo(85.5202, 4)
    expect(nilai(tabelUmur('tbu', 'pr'), 24, 1)).toBeCloseTo(85.7153, 4)
  })

  it('BB/PB dan BB/TB median pada batas tabel', () => {
    expect(nilai(tabelPanjang('bbpb', 'lk'), 45, 1)).toBeCloseTo(2.441, 3)
    expect(nilai(tabelPanjang('bbpb', 'lk'), 110, 1)).toBeCloseTo(18.2689, 4)
    expect(nilai(tabelPanjang('bbpb', 'pr'), 45, 1)).toBeCloseTo(2.4607, 4)
    expect(nilai(tabelPanjang('bbpb', 'pr'), 110, 1)).toBeCloseTo(18.3324, 4)
    expect(nilai(tabelPanjang('bbtb', 'lk'), 65, 1)).toBeCloseTo(7.4327, 4)
    expect(nilai(tabelPanjang('bbtb', 'lk'), 120, 1)).toBeCloseTo(22.353, 3)
    expect(nilai(tabelPanjang('bbtb', 'pr'), 65, 1)).toBeCloseTo(7.2402, 4)
    expect(nilai(tabelPanjang('bbtb', 'pr'), 120, 1)).toBeCloseTo(22.8173, 4)
  })

  it('baris 95,5 cm BB/PB perempuan memakai nilai resmi WHO, bukan nilai salah salin', () => {
    // Uji khusus untuk kesalahan yang ditemukan pada aplikasi versi Firebase.
    const t = tabelPanjang('bbpb', 'pr')
    expect(nilai(t, 95.5, 1)).toBeCloseTo(13.8408, 4)
    expect(nilai(t, 95.5, 2)).toBeCloseTo(0.08972, 5)
    // Nilai lama yang keliru, tidak boleh muncul lagi.
    expect(nilai(t, 95.5, 1)).not.toBeCloseTo(14.0186, 4)
  })
})
