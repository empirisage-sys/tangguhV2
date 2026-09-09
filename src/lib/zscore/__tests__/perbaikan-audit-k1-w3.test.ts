/**
 * Uji pengunci dua temuan audit September 2026.
 *
 * K-1  Target tumbuh kejar hilang tanpa keterangan pada anak yang lebih tinggi
 *      daripada median TB/U umur 60 bulan.
 * W-3  Ambang kenaikan berat dari jalur cadangan dilabeli "WHO" di layar, dan
 *      ambang WHO yang negatif tersaji sebagai "+-105 g".
 *
 * Kedua temuan lolos dari 465 uji yang sudah ada. Berkas ini ada supaya
 * keduanya tidak dapat kembali diam-diam.
 */
import { describe, expect, it } from 'vitest'
import { tabelVelocity } from '@/lib/who'
import { hitungSkrining } from '../index'
import { rdaCatchUpKkalPerKg, cariUsiaTinggi, rdaKkalPerKg } from '../gizi'
import { hitungVelocity, ambangP5Gram } from '../velocity'
import { formatGramBertanda, formatKiloBertanda } from '@/lib/tampilan/format'
import { sumberAmbangVelocity } from '@/lib/tampilan/status'
import type { KodeMetodeVelocity } from '../tipe'

/** Tanggal lahir yang menghasilkan umur tertentu pada 9 September 2026. */
function lahirUntukUmur(bulan: number): string {
  const hari = Math.round(bulan * 30.4375)
  return new Date(Date.UTC(2026, 8, 9) - hari * 86_400_000).toISOString().slice(0, 10)
}

const dasar = { tanggalPeriksa: '2026-09-09', posisiUkur: 'otomatis' } as const

describe('K-1 target tumbuh kejar pada anak di luar rentang usia-tinggi', () => {
  it('anak gizi buruk yang lebih tinggi dari median 60 bulan tetap mendapat target tumbuh kejar', () => {
    const h = hitungSkrining({
      ...dasar,
      tanggalLahir: lahirUntukUmur(58),
      jenisKelamin: 'lk',
      beratKg: 12.5,
      panjangCm: 110,
    })

    // Prasyarat kasus: memang gizi buruk, dan memang di luar tabel usia-tinggi.
    expect(h.statusBBTB).toBe('gizi_buruk')
    expect(h.gizi.usiaTinggiBulan).toBeNull()
    expect(h.gizi.posisiUsiaTinggi).toBe('di_atas_median_60_bulan')

    // Inti temuan K-1: dahulu ketiga hal di bawah bernilai null / 'pemeliharaan'.
    expect(h.gizi.rdaCatchUpKkalPerKg).toBe(90)
    expect(h.gizi.kaloriCatchUpKkal).toBe(Math.round(90 * (h.gizi.beratIdealKg as number)))
    expect(h.gizi.metode).toBe('catch_up')
    expect(h.gizi.alasanCatchUpKosong).toBeNull()

    // Selisihnya terhadap pemeliharaan tidak boleh sekadar berbeda tipis:
    // inilah besaran yang dahulu hilang dari layar dietisien.
    expect((h.gizi.kaloriCatchUpKkal as number) - h.gizi.kaloriPemeliharaanKkal).toBeGreaterThan(
      400,
    )
  })

  it('keadaan di luar tabel WAJIB berketerangan, meski pengukurannya sahih', () => {
    const h = hitungSkrining({
      ...dasar,
      tanggalLahir: lahirUntukUmur(58),
      jenisKelamin: 'lk',
      beratKg: 12.5,
      panjangCm: 110,
    })

    // Pengukurannya sendiri wajar, jadi bukan kasus di luar rentang.
    expect(h.diLuarRentang).toBe(false)
    // Namun catatannya harus ada. Dahulu null, dan tampilan pun menelannya.
    expect(h.catatanDiLuarRentang).not.toBeNull()
    expect(h.catatanDiLuarRentang).toContain('usia-tinggi')
    expect(h.catatanDiLuarRentang).toContain('90 kkal/kg')
  })

  it('anak lebih pendek daripada median panjang lahir memakai anak tangga RDA bawah', () => {
    const h = hitungSkrining({
      ...dasar,
      tanggalLahir: lahirUntukUmur(2),
      jenisKelamin: 'lk',
      beratKg: 2.0,
      panjangCm: 46,
    })

    expect(h.gizi.posisiUsiaTinggi).toBe('di_bawah_median_lahir')
    expect(h.gizi.rdaCatchUpKkalPerKg).toBe(110)
    expect(h.gizi.kaloriCatchUpKkal).not.toBeNull()
    expect(h.catatanDiLuarRentang).toContain('110 kkal/kg')
  })

  it('perilaku di DALAM tabel tidak berubah sedikit pun', () => {
    const h = hitungSkrining({
      ...dasar,
      tanggalLahir: lahirUntukUmur(54),
      jenisKelamin: 'lk',
      beratKg: 12,
      panjangCm: 108,
    })

    expect(h.gizi.posisiUsiaTinggi).toBe('dalam_tabel')
    expect(h.gizi.usiaTinggiBulan).toBeCloseTo(56.42, 1)
    expect(h.gizi.rdaCatchUpKkalPerKg).toBe(90)
    expect(h.gizi.kaloriCatchUpKkal).toBe(1604)
    expect(h.gizi.metode).toBe('catch_up')
  })

  it('anak gizi baik tidak mendapat catatan tambahan apa pun', () => {
    const h = hitungSkrining({
      ...dasar,
      tanggalLahir: lahirUntukUmur(24),
      jenisKelamin: 'lk',
      beratKg: 12.2,
      panjangCm: 87.1,
    })

    expect(h.gizi.posisiUsiaTinggi).toBe('dalam_tabel')
    expect(h.gizi.metode).toBe('pemeliharaan')
    expect(h.gizi.alasanCatchUpKosong).toBeNull()
    expect(h.catatanDiLuarRentang).toBeNull()
  })

  it('RDA di luar tabel ditolak bila anak tangga TABEL_RDA tidak lagi seragam', () => {
    // Kesetaraan yang menjadi dasar perbaikan ini diperiksa saat berjalan,
    // bukan diasumsikan. Uji ini merekam alasannya secara eksplisit.
    expect(rdaKkalPerKg(60)).toBe(rdaKkalPerKg(Number.POSITIVE_INFINITY))
    expect(rdaKkalPerKg(0)).toBe(rdaKkalPerKg(Number.NEGATIVE_INFINITY))

    expect(rdaCatchUpKkalPerKg({ bulan: null, posisi: 'di_atas_median_60_bulan' })).toBe(90)
    expect(rdaCatchUpKkalPerKg({ bulan: null, posisi: 'di_bawah_median_lahir' })).toBe(110)
    expect(rdaCatchUpKkalPerKg({ bulan: null, posisi: 'dalam_tabel' })).toBeNull()
    expect(rdaCatchUpKkalPerKg({ bulan: 24, posisi: 'dalam_tabel' })).toBe(100)
  })

  it('batas rentang usia-tinggi berada tepat pada median tabel', () => {
    expect(cariUsiaTinggi(109.9, 'lk').posisi).toBe('dalam_tabel')
    expect(cariUsiaTinggi(110, 'lk').posisi).toBe('di_atas_median_60_bulan')
    expect(cariUsiaTinggi(49.9, 'lk').posisi).toBe('dalam_tabel')
    expect(cariUsiaTinggi(49.8, 'lk').posisi).toBe('di_bawah_median_lahir')
  })
})

describe('W-3 sumber ambang kenaikan berat tidak boleh salah label', () => {
  it('ambang negatif tidak lagi tersaji sebagai "+-105 g"', () => {
    expect(formatGramBertanda(-105)).toBe('-105 g')
    expect(formatGramBertanda(240)).toBe('+240 g')
    expect(formatGramBertanda(0)).toBe('0 g')
    expect(formatGramBertanda(null)).toBe('-')
    expect(formatGramBertanda(-105)).not.toContain('+-')

    expect(formatKiloBertanda(-105)).not.toContain('+-')
    expect(formatKiloBertanda(-105)).toContain('-0,11')
    expect(formatKiloBertanda(1250)).toBe('+1,25 kg')
  })

  it('jalur cadangan tidak pernah dilabeli WHO, jalur WHO selalu dilabeli WHO', () => {
    const who = sumberAmbangVelocity('who_velocity')
    expect(who.perkiraan).toBe(false)
    expect(who.judul).toContain('WHO')

    const kbm = sumberAmbangVelocity('kbm_perkiraan')
    expect(kbm.perkiraan).toBe(true)
    expect(kbm.judul).not.toContain('WHO')
    expect(kbm.dalamKalimat).not.toContain('WHO')
    expect(kbm.keterangan).toContain('Bukan standar WHO')
  })

  it('setiap metode yang berlabel perkiraan wajib bebas kata WHO pada judulnya', () => {
    const semua: KodeMetodeVelocity[] = ['who_velocity', 'kbm_perkiraan', 'tidak_ada']
    for (const m of semua) {
      const s = sumberAmbangVelocity(m)
      if (s.perkiraan) expect(s.judul).not.toContain('WHO')
      expect(s.keterangan.length).toBeGreaterThan(10)
    }
  })

  it('balita 12 bulan yang ditimbang bulanan memakai jalur cadangan, dan label ikut berubah', () => {
    const h = hitungVelocity({
      tanggalLahir: lahirUntukUmur(13),
      jenisKelamin: 'lk',
      tanggalAwal: '2026-08-10',
      beratAwalKg: 9.0,
      tanggalAkhir: '2026-09-09',
      beratAkhirKg: 9.05,
    })

    // Kasus inilah yang paling sering terjadi di posyandu, dan justru inilah
    // yang dahulu tampil dengan label WHO.
    expect(h.metode).toBe('kbm_perkiraan')
    expect(sumberAmbangVelocity(h.metode).judul).not.toContain('WHO')
  })

  it('bayi 11 bulan memakai WHO, dan ambangnya memang negatif', () => {
    const h = hitungVelocity({
      tanggalLahir: lahirUntukUmur(12),
      jenisKelamin: 'lk',
      tanggalAwal: '2026-08-10',
      beratAwalKg: 9.0,
      tanggalAkhir: '2026-09-09',
      beratAkhirKg: 9.05,
    })

    expect(h.metode).toBe('who_velocity')
    expect(h.kenaikanMinimalGram).toBeLessThan(0)
    expect(h.ambangNegatif).toBe(true)
    expect(formatGramBertanda(h.kenaikanMinimalGram)).toMatch(/^-\d/)
  })

  it('ambang WHO negatif memang banyak, jadi bentuk rusaknya bukan kasus tepi', () => {
    let negatif = 0
    let total = 0
    for (const iv of ['1bln', '2bln', '3bln'] as const) {
      for (const s of ['lk', 'pr'] as const) {
        const t = tabelVelocity(iv, s)
        const hari = iv === '1bln' ? 30 : iv === '2bln' ? 61 : 91
        for (let b = t.bulanAwalMin; b <= t.bulanAwalMaks; b += 1) {
          const a = ambangP5Gram(t, b, hari)
          if (a === null) continue
          total += 1
          if (a < 0) negatif += 1
        }
      }
    }
    expect(total).toBe(114)
    expect(negatif).toBe(33)
  })
})
