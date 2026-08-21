import { describe, expect, it } from 'vitest'
import { tabelVelocity } from '@/lib/who'
import type { IntervalVelocity, JenisKelamin } from '@/lib/who'
import {
  ambangKbmGram,
  ambangP5Gram,
  hitungVelocity,
  pilihInterval,
  SELISIH_HARI_MAKS,
  SELISIH_HARI_MIN,
} from '@/lib/zscore/velocity'
import { hitungVelocityLama } from '@/../referensi/engine-lama'
import { DELTA_RESMI_WHO, P5_RESMI_WHO } from './fixtur-who-p5'

const KOMBINASI: Array<[JenisKelamin, IntervalVelocity]> = [
  ['lk', '1bln'],
  ['pr', '1bln'],
  ['lk', '2bln'],
  ['pr', '2bln'],
  ['lk', '3bln'],
  ['pr', '3bln'],
]

describe('parameter delta tabel velocity', () => {
  it('nilai delta cocok dengan tabel terbitan WHO', () => {
    for (const [seks, interval] of KOMBINASI) {
      const tabel = tabelVelocity(interval, seks)
      expect(tabel.deltaGram, `${seks} ${interval}`).toBe(
        DELTA_RESMI_WHO[`${seks}-${interval}`],
      )
    }
  })

  it('delta interval 3 bulan berbeda antara laki-laki dan perempuan', () => {
    // 650 g untuk laki-laki, 800 g untuk perempuan. Perbedaan ini mudah terlewat
    // bila delta diperlakukan sebagai satu angka untuk semua tabel.
    expect(tabelVelocity('3bln', 'lk').deltaGram).toBe(650)
    expect(tabelVelocity('3bln', 'pr').deltaGram).toBe(800)
  })
})

describe('ambangP5Gram menghasilkan nilai yang sama dengan tabel terbitan WHO', () => {
  it.each(KOMBINASI)(
    'seluruh baris tabel %s interval %s cocok dengan kolom persentil 5 WHO',
    (seks, interval) => {
      const tabel = tabelVelocity(interval, seks)
      const resmi = P5_RESMI_WHO[`${seks}-${interval}`]
      expect(resmi).toBeDefined()

      let diperiksa = 0
      for (const kunci of Object.keys(resmi as Record<number, number>)) {
        const bulan = Number(kunci)
        const diharapkan = (resmi as Record<number, number>)[bulan] as number
        const dihitung = ambangP5Gram(tabel, bulan, tabel.hariStandar)

        expect(dihitung, `${seks} ${interval} bulan ${bulan}`).not.toBeNull()
        // Toleransi 1,5 gram karena tabel WHO dibulatkan ke gram terdekat.
        expect(
          Math.abs((dihitung as number) - diharapkan),
          `${seks} ${interval} bulan ${bulan}: dihitung ${dihitung}, WHO ${diharapkan}`,
        ).toBeLessThanOrEqual(1.5)
        diperiksa += 1
      }
      expect(diperiksa).toBeGreaterThan(0)
    },
  )

  it('mengembalikan null bila umur awal di luar cakupan tabel', () => {
    const satuBulan = tabelVelocity('1bln', 'lk')
    // Tabel interval 1 bulan hanya mencakup umur awal 0 sampai 11 bulan.
    expect(ambangP5Gram(satuBulan, 12, 30)).toBeNull()
    expect(ambangP5Gram(satuBulan, 30, 30)).toBeNull()
    expect(ambangP5Gram(satuBulan, 11, 30)).not.toBeNull()
  })
})

describe('perbandingan dengan engine lama: dampak delta yang tidak dikurangkan', () => {
  it('engine lama selalu meminta kenaikan lebih tinggi tepat sebesar delta', () => {
    const kasus: Array<{ seks: JenisKelamin; interval: IntervalVelocity; bulan: number }> = [
      { seks: 'lk', interval: '1bln', bulan: 0 },
      { seks: 'lk', interval: '1bln', bulan: 6 },
      { seks: 'lk', interval: '1bln', bulan: 11 },
      { seks: 'pr', interval: '1bln', bulan: 3 },
      { seks: 'lk', interval: '2bln', bulan: 12 },
      { seks: 'pr', interval: '3bln', bulan: 21 },
    ]

    for (const { seks, interval, bulan } of kasus) {
      const tabel = tabelVelocity(interval, seks)
      const baru = ambangP5Gram(tabel, bulan, tabel.hariStandar) as number
      const resmi = (P5_RESMI_WHO[`${seks}-${interval}`] as Record<number, number>)[
        bulan
      ] as number

      expect(Math.abs(baru - resmi)).toBeLessThanOrEqual(1.5)
      // Ambang lama = ambang benar + delta.
      const lama = baru + tabel.deltaGram
      expect(lama - baru).toBe(tabel.deltaGram)
    }
  })

  it('kasus nyata: bayi laki-laki 11 bulan dinyatakan faltering oleh engine lama, normal oleh WHO', () => {
    // Umur awal 11 bulan (335 hari), jarak timbang 30 hari, kenaikan 100 gram.
    const input = {
      tanggalLahir: '2025-09-01',
      jenisKelamin: 'lk' as const,
      tanggalAwal: '2026-08-02', // 335 hari, yaitu 11,0 bulan
      beratAwalKg: 9.0,
      tanggalAkhir: '2026-09-01', // 30 hari kemudian
      beratAkhirKg: 9.1,
    }

    const baru = hitungVelocity(input)
    expect(baru.umurAwalBulan).toBeGreaterThanOrEqual(11)
    expect(baru.umurAwalBulan).toBeLessThan(12)
    expect(baru.kenaikanAktualGram).toBe(100)

    // Ambang WHO untuk umur 11 bulan interval 1 bulan bernilai negatif:
    // lima persen bayi sehat memang kehilangan berat pada bulan itu.
    expect(baru.kenaikanMinimalGram).toBeLessThan(0)
    expect(baru.status).toBe('naik')

    const lama = hitungVelocityLama(
      input.tanggalLahir,
      input.tanggalAwal,
      input.beratAwalKg,
      input.tanggalAkhir,
      input.beratAkhirKg,
      input.jenisKelamin,
    )
    expect(lama).not.toBeNull()
    // Engine lama meminta kenaikan positif ratusan gram, lalu menyatakan faltering.
    expect((lama as { kenaikanMinimal: number }).kenaikanMinimal).toBeGreaterThan(250)
    expect((lama as { isFaltering: boolean }).isFaltering).toBe(true)

    const selisihAmbang =
      (lama as { kenaikanMinimal: number }).kenaikanMinimal -
      (baru.kenaikanMinimalGram as number)
    expect(selisihAmbang).toBeGreaterThan(380)
    expect(selisihAmbang).toBeLessThan(420)
  })
})

describe('pemilihan interval dan pembatasan jarak timbang', () => {
  it('memetakan jarak hari ke tabel interval terdekat', () => {
    expect(pilihInterval(30)).toBe('1bln')
    expect(pilihInterval(45)).toBe('1bln')
    expect(pilihInterval(46)).toBe('2bln')
    expect(pilihInterval(75)).toBe('2bln')
    expect(pilihInterval(76)).toBe('3bln')
    expect(pilihInterval(110)).toBe('3bln')
  })

  it('menolak jarak di luar 21 sampai 110 hari', () => {
    expect(pilihInterval(SELISIH_HARI_MIN - 1)).toBeNull()
    expect(pilihInterval(SELISIH_HARI_MAKS + 1)).toBeNull()
    expect(pilihInterval(200)).toBeNull()
  })

  it('jarak 200 hari tidak dinilai, sedangkan engine lama menskalakan tanpa batas', () => {
    const input = {
      tanggalLahir: '2025-01-01',
      jenisKelamin: 'pr' as const,
      tanggalAwal: '2025-06-01',
      beratAwalKg: 7.0,
      tanggalAkhir: '2025-12-18', // 200 hari
      beratAkhirKg: 8.0,
    }

    const baru = hitungVelocity(input)
    expect(baru.status).toBe('tidak_dapat_dinilai')
    expect(baru.kenaikanMinimalGram).toBeNull()
    expect(baru.alasan).toContain('110 hari')

    const lama = hitungVelocityLama(
      input.tanggalLahir,
      input.tanggalAwal,
      input.beratAwalKg,
      input.tanggalAkhir,
      input.beratAkhirKg,
      input.jenisKelamin,
    )
    // Engine lama tetap memberi angka, hasil penskalaan tabel 3 bulan lebih dari dua kali.
    expect(lama).not.toBeNull()
    expect((lama as { kenaikanMinimal: number }).kenaikanMinimal).toBeGreaterThan(1500)
  })

  it('jarak terlalu pendek dijelaskan, bukan dipaksa dinilai', () => {
    const hasil = hitungVelocity({
      tanggalLahir: '2026-01-01',
      jenisKelamin: 'lk',
      tanggalAwal: '2026-06-01',
      beratAwalKg: 7.5,
      tanggalAkhir: '2026-06-10',
      beratAkhirKg: 7.6,
    })
    expect(hasil.status).toBe('tidak_dapat_dinilai')
    expect(hasil.alasan).toContain('21 hari')
  })

  it('menolak urutan tanggal yang tidak logis', () => {
    const hasil = hitungVelocity({
      tanggalLahir: '2026-01-01',
      jenisKelamin: 'lk',
      tanggalAwal: '2026-06-01',
      beratAwalKg: 7.5,
      tanggalAkhir: '2026-05-01',
      beratAkhirKg: 7.6,
    })
    expect(hasil.status).toBe('tidak_dapat_dinilai')
  })
})

describe('jalur cadangan KBM di luar cakupan tabel WHO', () => {
  it('anak umur 3 tahun dinilai dengan KBM, dengan metode yang dinyatakan terbuka', () => {
    const hasil = hitungVelocity({
      tanggalLahir: '2023-01-01',
      jenisKelamin: 'lk',
      tanggalAwal: '2026-01-01', // umur 36 bulan
      beratAwalKg: 13.0,
      tanggalAkhir: '2026-02-01', // 31 hari
      beratAkhirKg: 13.3,
    })

    expect(hasil.status).not.toBe('tidak_dapat_dinilai')
    expect(hasil.metode).toContain('KBM perkiraan')
    expect(hasil.kenaikanMinimalGram).toBe(ambangKbmGram(hasil.umurAwalBulan, 31))
  })

  it('anak umur 18 bulan dengan jarak 1 bulan juga memakai KBM, karena tabel 1 bulan berhenti di 12 bulan', () => {
    const hasil = hitungVelocity({
      tanggalLahir: '2025-01-01',
      jenisKelamin: 'pr',
      tanggalAwal: '2026-07-05',
      beratAwalKg: 10.0,
      tanggalAkhir: '2026-08-04',
      beratAkhirKg: 10.2,
    })
    expect(hasil.metode).toContain('KBM perkiraan')
  })

  it('anak umur 6 bulan dengan jarak 1 bulan memakai standar WHO', () => {
    const hasil = hitungVelocity({
      tanggalLahir: '2026-02-01',
      jenisKelamin: 'pr',
      tanggalAwal: '2026-08-01',
      beratAwalKg: 7.0,
      tanggalAkhir: '2026-08-31',
      beratAkhirKg: 7.3,
    })
    expect(hasil.metode).toContain('WHO weight velocity')
  })
})

describe('penetapan status', () => {
  it('berat turun selalu berstatus tidak naik', () => {
    const hasil = hitungVelocity({
      tanggalLahir: '2026-01-01',
      jenisKelamin: 'lk',
      tanggalAwal: '2026-04-01',
      beratAwalKg: 6.5,
      tanggalAkhir: '2026-05-01',
      beratAkhirKg: 6.2,
    })
    expect(hasil.kenaikanAktualGram).toBe(-300)
    expect(hasil.status).toBe('tidak_naik')
  })

  it('kenaikan positif tetapi di bawah ambang berstatus growth faltering', () => {
    const hasil = hitungVelocity({
      tanggalLahir: '2026-04-01',
      jenisKelamin: 'lk',
      tanggalAwal: '2026-05-01', // umur sekitar 1 bulan, ambang masih tinggi
      beratAwalKg: 4.5,
      tanggalAkhir: '2026-05-31',
      beratAkhirKg: 4.6,
    })
    expect(hasil.kenaikanAktualGram).toBe(100)
    expect(hasil.kenaikanMinimalGram).toBeGreaterThan(100)
    expect(hasil.status).toBe('growth_faltering')
  })
})
