/**
 * Uji pengunci: tanggal setengah ketik tidak boleh mematikan halaman.
 *
 * Ditemukan Pak Nelitie di produksi pada 9 September 2026. Mengetik tanggal
 * lahir di halaman skrining tamu menghasilkan layar
 * "Application error: a client-side exception has occurred", dengan console
 * berbunyi:
 *
 *   Uncaught TanggalTidakValidError: Tanggal lahir harus berformat YYYY-MM-DD,
 *   diterima: "0002-01-01"
 *
 * Dua hal salah sekaligus. Pertama, "0002-01-01" JUSTRU berformat YYYY-MM-DD,
 * jadi pesannya menyesatkan; yang menolaknya adalah `Date.UTC`, yang memetakan
 * tahun 0-99 ke 1900+tahun sehingga pemeriksaan pulang-pergi gagal. Kedua, dan
 * yang sebenarnya merusak: perhitungan itu dipanggil di BADAN KOMPONEN, yang
 * dijalankan ulang pada setiap ketukan — sehingga lemparan biasa berubah
 * menjadi matinya seluruh pohon React.
 */
import { describe, expect, it } from 'vitest'
import { keHariEpoch } from '@/lib/zscore/umur'
import {
  tanggalValid,
  TanggalTidakValidError,
  TAHUN_MIN,
  hitungUsiaKoreksi,
  tanggalLahirEfektif,
  hitungUmurKalender,
} from '@/lib/zscore'

/** Nilai yang benar-benar dikirim medan tanggal saat "2026" diketik satu per satu. */
const SAAT_MENGETIK_2026 = ['0002-01-01', '0020-01-01', '0202-01-01']

describe('tanggalValid menolak tanpa melempar', () => {
  it('setiap nilai antara saat mengetik tahun ditolak', () => {
    for (const nilai of SAAT_MENGETIK_2026) {
      expect(tanggalValid(nilai), nilai).toBe(false)
    }
    // Dan yang terakhir, tahun lengkapnya, diterima.
    expect(tanggalValid('2026-01-01')).toBe(true)
  })

  it('tidak pernah melempar, apa pun masukannya', () => {
    const aneh: unknown[] = ['', '   ', 'abc', '2026-13-45', '2025-02-29', null, undefined, 42, {}]
    for (const nilai of aneh) {
      expect(() => tanggalValid(nilai)).not.toThrow()
      expect(tanggalValid(nilai)).toBe(false)
    }
  })

  it('menerima tanggal wajar', () => {
    expect(tanggalValid('1900-01-01')).toBe(true)
    expect(tanggalValid('2026-09-09')).toBe(true)
    expect(tanggalValid('2024-02-29')).toBe(true) // kabisat
  })
})

describe('pesan galat menyebut alasan yang sebenarnya', () => {
  it('tahun yang tidak masuk akal tidak lagi disebut salah format', () => {
    // Format "0002-01-01" memang sudah YYYY-MM-DD. Menyebutnya salah format
    // menyesatkan siapa pun yang membaca console.
    expect(() => keHariEpoch('0002-01-01', 'Tanggal lahir')).toThrow(TanggalTidakValidError)
    try {
      keHariEpoch('0002-01-01', 'Tanggal lahir')
    } catch (e) {
      const pesan = (e as Error).message
      expect(pesan).toContain('tahun yang tidak masuk akal')
      expect(pesan).toContain(String(TAHUN_MIN))
      expect(pesan).not.toContain('harus berformat')
    }
  })

  it('bulan atau tanggal yang tidak ada punya alasannya sendiri', () => {
    try {
      keHariEpoch('2026-13-01')
    } catch (e) {
      expect((e as Error).message).toContain('bulan atau tanggal yang tidak ada')
    }
  })

  it('tanggal yang tidak ada pada kalender punya alasannya sendiri', () => {
    try {
      keHariEpoch('2025-02-29')
    } catch (e) {
      expect((e as Error).message).toContain('tidak ada pada kalender')
    }
  })

  it('bentuk yang memang salah format tetap disebut salah format', () => {
    try {
      keHariEpoch('01-01-2026')
    } catch (e) {
      expect((e as Error).message).toContain('harus berformat YYYY-MM-DD')
    }
  })
})

describe('perhitungan yang dipanggil di badan komponen masih melempar', () => {
  it('itulah sebabnya penjaga wajib ada sebelum memanggilnya', () => {
    // Uji ini merekam ALASAN penjagaan itu ada. Bila suatu saat fungsi-fungsi
    // ini dibuat tidak melempar, penjaganya boleh ditinjau ulang — tetapi
    // selama masih melempar, memanggilnya tanpa `tanggalValid` berarti satu
    // ketukan papan tik dapat mematikan halaman.
    for (const nilai of SAAT_MENGETIK_2026) {
      expect(() => hitungUsiaKoreksi(nilai, '2026-09-09', 32)).toThrow(TanggalTidakValidError)
      expect(() => tanggalLahirEfektif(nilai, '2026-09-09', 32)).toThrow(TanggalTidakValidError)
      expect(() => hitungUmurKalender('2024-01-01', nilai)).toThrow(TanggalTidakValidError)
    }
  })

  it('dengan tanggal yang sah, ketiganya bekerja seperti biasa', () => {
    expect(() => hitungUsiaKoreksi('2026-03-09', '2026-09-09', 32)).not.toThrow()
    expect(tanggalLahirEfektif('2026-03-09', '2026-09-09', 32)).toBe('2026-05-04')
    expect(hitungUmurKalender('2024-01-01', '2026-09-09').totalHari).toBeGreaterThan(0)
  })
})

describe('batas tahun tidak memotong tanggal lahir yang wajar', () => {
  it('tepat pada batas diterima, satu tahun di bawahnya ditolak', () => {
    expect(tanggalValid(`${TAHUN_MIN}-01-01`)).toBe(true)
    expect(tanggalValid(`${TAHUN_MIN - 1}-01-01`)).toBe(false)
  })

  it('balita mana pun lahir jauh setelah batas itu', () => {
    // Standar WHO yang dipakai aplikasi ini berlaku 0-60 bulan, jadi tanggal
    // lahir yang mungkin selalu beberapa tahun terakhir saja.
    expect(TAHUN_MIN).toBeLessThan(new Date().getUTCFullYear() - 5)
  })
})
