import { describe, expect, it } from 'vitest'
import { hitungSkrining } from '@/lib/zscore'
import { lmsUmurHarian, tabelUmur, UMUR_MAKS_HARI_TABEL } from '@/lib/who'
import type { JenisKelamin } from '@/lib/who'

/**
 * zscore-2.3.0: BB/U dan TB/U dari tabel HARIAN WHO.
 *
 * Nilai harapan pada kasus klinis di bawah dihitung terpisah dari tabel harian
 * resmi WHO (expanded tables, cdn.who.int) dan dicocokkan dengan WHO Anthro.
 * Ketiganya adalah kasus yang salah diklasifikasi oleh interpolasi bulanan.
 */

const TGL_LAHIR = '2020-01-01'
const tanggalSetelah = (hari: number): string =>
  new Date(Date.UTC(2020, 0, 1) + hari * 86_400_000).toISOString().slice(0, 10)

describe('integritas tabel harian WHO', () => {
  for (const indikator of ['bbu', 'tbu'] as const) {
    for (const seks of ['lk', 'pr'] as const) {
      it(`${indikator} ${seks}: 1857 baris, nilai sah`, () => {
        for (let hari = 0; hari <= UMUR_MAKS_HARI_TABEL; hari += 1) {
          const lms = lmsUmurHarian(indikator, seks, hari)
          expect(lms).not.toBeNull()
          const [L, M, S] = lms!
          expect(Number.isFinite(L)).toBe(true)
          expect(M).toBeGreaterThan(0)
          expect(S).toBeGreaterThan(0)
        }
        expect(lmsUmurHarian(indikator, seks, UMUR_MAKS_HARI_TABEL + 1)).toBeNull()
        expect(lmsUmurHarian(indikator, seks, -1)).toBeNull()
        expect(lmsUmurHarian(indikator, seks, 10.5)).toBeNull()
      })

      it(`${indikator} ${seks}: sejalan dengan tabel bulanan WHO pada setiap bulan`, () => {
        const bulanan = tabelUmur(indikator, seks)
        for (let bulan = 0; bulan <= 60; bulan += 1) {
          const hariTepat = bulan * 30.4375
          let bawah = Math.floor(hariTepat)
          let atas = Math.min(bawah + 1, UMUR_MAKS_HARI_TABEL)
          let f = hariTepat - bawah
          // Bulan 24 TB/U di tabel bulanan berbasis tinggi berdiri (hari 731 ke atas).
          if (indikator === 'tbu' && bulan === 24) { bawah = 731; atas = 731; f = 0 }
          const mBawah = lmsUmurHarian(indikator, seks, bawah)![1]
          const mAtas = lmsUmurHarian(indikator, seks, atas)![1]
          const mHarian = mBawah + f * (mAtas - mBawah)
          const mBulanan = bulanan[bulan]![1]
          expect(Math.abs(mHarian - mBulanan) / mBulanan).toBeLessThan(2e-4)
        }
      })
    }
  }

  it('TB/U berganti basis dari panjang ke tinggi tepat setelah hari 730', () => {
    for (const seks of ['lk', 'pr'] as JenisKelamin[]) {
      const m730 = lmsUmurHarian('tbu', seks, 730)![1]
      const m731 = lmsUmurHarian('tbu', seks, 731)![1]
      // Median tinggi berdiri sekitar 0,7 cm di bawah median panjang terlentang.
      expect(m730 - m731).toBeGreaterThan(0.6)
      expect(m730 - m731).toBeLessThan(0.75)
    }
  })
})

describe('kasus yang dulu salah diklasifikasi interpolasi bulanan', () => {
  it('laki-laki 725 hari, PB 81,1 cm: pendek (WHO -2,155), dulu normal -1,97', () => {
    const r = hitungSkrining({
      tanggalLahir: TGL_LAHIR, tanggalPeriksa: tanggalSetelah(725), jenisKelamin: 'lk',
      beratKg: 10.8, panjangCm: 81.1, posisiUkur: 'otomatis',
    })
    expect(r.tbu.z).toBeCloseTo(-2.155, 2)
    expect(r.statusTBU).toBe('pendek')
  })

  it('perempuan 8 hari, BB 2,51 kg: normal (WHO -1,944), dulu kurang -2,21', () => {
    const r = hitungSkrining({
      tanggalLahir: TGL_LAHIR, tanggalPeriksa: tanggalSetelah(8), jenisKelamin: 'pr',
      beratKg: 2.51, panjangCm: 50.5, posisiUkur: 'otomatis',
    })
    expect(r.bbu.z).toBeCloseTo(-1.944, 2)
    expect(r.statusBBU).toBe('berat_badan_normal')
  })

  it('laki-laki 730 hari, PB 87,8 cm: Z sekitar 0, dulu +0,23', () => {
    const r = hitungSkrining({
      tanggalLahir: TGL_LAHIR, tanggalPeriksa: tanggalSetelah(730), jenisKelamin: 'lk',
      beratKg: 12, panjangCm: 87.8, posisiUkur: 'otomatis',
    })
    expect(r.standarPanjang).toBe('terlentang')
    expect(Math.abs(r.tbu.z!)).toBeLessThan(0.01)
  })

  it('laki-laki 731 hari memakai basis tinggi berdiri', () => {
    const r = hitungSkrining({
      tanggalLahir: TGL_LAHIR, tanggalPeriksa: tanggalSetelah(731), jenisKelamin: 'lk',
      beratKg: 12, panjangCm: 87.1, posisiUkur: 'otomatis',
    })
    expect(r.standarPanjang).toBe('berdiri')
    expect(Math.abs(r.tbu.z!)).toBeLessThan(0.02)
  })
})

describe('bayi prematur sebelum umur cukup bulan', () => {
  it('diberi alasan belum_cukup_bulan, bukan tanggal terbalik', () => {
    const r = hitungSkrining({
      tanggalLahir: TGL_LAHIR, tanggalPeriksa: tanggalSetelah(30), jenisKelamin: 'lk',
      beratKg: 1.6, panjangCm: 42, posisiUkur: 'otomatis', usiaGestasiMinggu: 28,
    })
    expect(r.alasanDiLuarRentang).toContain('belum_cukup_bulan')
    expect(r.alasanDiLuarRentang).not.toContain('umur_negatif')
    expect(r.catatanDiLuarRentang).toContain('umur cukup bulan')
    expect(r.bbu.z).toBeNull()
  })

  it('tanggal periksa sebelum tanggal lahir tetap umur_negatif', () => {
    const r = hitungSkrining({
      tanggalLahir: TGL_LAHIR, tanggalPeriksa: '2019-12-25', jenisKelamin: 'lk',
      beratKg: 3, panjangCm: 50, posisiUkur: 'otomatis', usiaGestasiMinggu: 32,
    })
    expect(r.alasanDiLuarRentang).toContain('umur_negatif')
    expect(r.alasanDiLuarRentang).not.toContain('belum_cukup_bulan')
  })
})
