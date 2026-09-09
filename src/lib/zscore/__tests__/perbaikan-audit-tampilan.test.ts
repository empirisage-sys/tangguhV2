/**
 * Uji pengunci temuan audit lapisan tampilan: pita Z-Score, kurva, tabel riwayat.
 *
 * Ketiga bagian ini tidak pernah disentuh 532 uji sebelumnya, karena seluruh uji
 * berhenti di mesin. Yang diuji di sini adalah bagian TAMPILAN yang murni dan
 * dapat dijalankan tanpa merender React: pemetaan angka menjadi posisi, label,
 * catatan kurva, dan pemformatan.
 */
import { describe, expect, it } from 'vitest'
import {
  segmenUntuk,
  titikLabelUntuk,
  persenKeZ,
  zKePersen,
  posisiPenanda,
  Z_MIN,
  Z_MAKS,
} from '@/lib/tampilan/pita'
import {
  seriBBU,
  seriBBTB,
  seriTrenZ,
  titikGambarAnak,
  type KunjunganRiwayat,
} from '@/lib/grafik/seri'
import { formatUmurBulan } from '@/lib/tampilan/format'

const kunjungan = (o: Partial<KunjunganRiwayat>): KunjunganRiwayat => ({
  tanggalPeriksa: '2026-01-01',
  umurBulan: 12,
  beratKg: 9,
  panjangTerkoreksiCm: 75,
  standarPanjang: 'terlentang',
  zBbu: 0,
  zTbu: 0,
  zBbtb: 0,
  ...o,
})

describe('P-1 setiap batas warna pita berangka', () => {
  it('BB/U memberi angka pada +1, tempat pita berubah menjadi kuning', () => {
    const label = titikLabelUntuk('bbu')
    expect(label).toContain(1)
    // Bentuk lama memakai satu daftar [-3,-2,0,2,3] untuk ketiga indikator:
    // +1 tidak berangka, sementara +2 berangka di TENGAH pita kuning BB/U.
    expect(label).not.toContain(2)
  })

  it('BB/TB memberi angka pada +1 dan +3, batas kuning dan merahnya', () => {
    const label = titikLabelUntuk('bbtb')
    expect(label).toContain(1)
    expect(label).toContain(3)
  })

  it('TB/U tidak memberi angka pada +1, karena di sana tidak ada batas', () => {
    const label = titikLabelUntuk('tbu')
    expect(label).not.toContain(1)
    expect(label).toContain(3)
  })

  it('setiap batas segmen benar-benar berangka pada ketiga indikator', () => {
    for (const ind of ['bbu', 'tbu', 'bbtb'] as const) {
      const label = titikLabelUntuk(ind)
      for (const s of segmenUntuk(ind)) {
        const z = persenKeZ(s.dariPersen)
        // Tepi pita memang tidak berangka; yang wajib berangka adalah batas klinis.
        if (z > Z_MIN + 1e-9 && z < Z_MAKS - 1e-9) {
          expect(label, `${ind} batas ${z}`).toContain(z)
        }
      }
    }
  })

  it('nol selalu berangka, dan urutannya menaik', () => {
    for (const ind of ['bbu', 'tbu', 'bbtb'] as const) {
      const label = titikLabelUntuk(ind)
      expect(label).toContain(0)
      expect([...label].sort((a, b) => a - b)).toEqual(label)
    }
  })

  it('persenKeZ adalah kebalikan zKePersen', () => {
    for (const z of [-4, -3, -2, -1, 0, 1, 2, 3, 4]) {
      expect(persenKeZ(zKePersen(z))).toBeCloseTo(z, 6)
    }
  })

  it('nilai di luar pita ditandai arahnya, bukan dijepit diam-diam', () => {
    expect(posisiPenanda(-5.8)).toEqual({ persen: 0, diLuarPita: true, arah: 'kiri' })
    expect(posisiPenanda(4.5)).toEqual({ persen: 100, diLuarPita: true, arah: 'kanan' })
    expect(posisiPenanda(-2)?.diLuarPita).toBe(false)
    expect(posisiPenanda(null)).toBeNull()
  })
})

describe('K-1 catatan kurva tidak boleh bertentangan dengan gambarnya', () => {
  it('titik tanpa nilai Z disebut TIDAK digambar, karena memang tidak', () => {
    const seri = seriBBU(
      [
        kunjungan({ tanggalPeriksa: '2026-01-01', zBbu: -1 }),
        kunjungan({ tanggalPeriksa: '2026-03-01', umurBulan: 14, zBbu: null }),
      ],
      'lk',
    )

    // Yang benar-benar digambar hanya satu.
    expect(seri.anak).toHaveLength(2)
    expect(titikGambarAnak(seri)).toHaveLength(1)

    const catatan = seri.catatan.join(' ')
    expect(catatan).toContain('TIDAK digambar')
    // Bentuk lama berbunyi "digambar tanpa nilai Z" — pembaca mencari titik
    // yang tidak pernah ada di layar.
    expect(catatan).not.toContain('titik digambar tanpa nilai Z')
  })
})

describe('K-2 titik di luar sumbu tren Z tidak boleh hilang tanpa keterangan', () => {
  it('kunjungan di atas 60 bulan disebutkan', () => {
    const seri = seriTrenZ([
      kunjungan({ umurBulan: 58, tanggalPeriksa: '2026-01-01' }),
      kunjungan({ umurBulan: 62, tanggalPeriksa: '2026-05-01' }),
    ])

    // Sumbu dijepit ke 60 bulan, titiknya tidak.
    expect(seri.domainX[1]).toBe(60)
    expect(seri.titik.map((t) => t.umurBulan)).toContain(62)
    expect(seri.catatan.join(' ')).toContain('di luar sumbu umur')
  })

  it('riwayat yang seluruhnya di dalam sumbu tidak memunculkan catatan itu', () => {
    const seri = seriTrenZ([
      kunjungan({ umurBulan: 10, tanggalPeriksa: '2026-01-01' }),
      kunjungan({ umurBulan: 12, tanggalPeriksa: '2026-03-01' }),
    ])
    expect(seri.catatan.join(' ')).not.toContain('di luar sumbu umur')
  })
})

describe('K-4 alasan titik BB/TB yang tak tergambar dijelaskan', () => {
  it('menyebut rentang tabel yang berlaku, bukan sekadar "di luar rentang"', () => {
    const seri = seriBBTB(
      [
        // 60 cm, di bawah batas bawah tabel BB/TB (65 cm)
        kunjungan({
          tanggalPeriksa: '2024-01-01',
          umurBulan: 6,
          panjangTerkoreksiCm: 60,
          beratKg: 6,
          standarPanjang: 'terlentang',
        }),
        kunjungan({
          tanggalPeriksa: '2026-01-01',
          umurBulan: 30,
          panjangTerkoreksiCm: 90,
          beratKg: 12,
          standarPanjang: 'berdiri',
        }),
      ],
      'lk',
    )

    expect(seri.anak).toHaveLength(1)
    const catatan = seri.catatan.join(' ')
    expect(catatan).toContain('65-120 cm')
    expect(catatan).toContain('pemeriksaan TERAKHIR')
    expect(catatan).toContain('tabel riwayat')
  })
})

describe('R-3 pemisah desimal Indonesia pada umur', () => {
  it('memakai koma, bukan titik', () => {
    expect(formatUmurBulan(23.98)).toBe('24 bulan')
    expect(formatUmurBulan(23.5)).toBe('23,5 bulan')
    expect(formatUmurBulan(6)).toBe('6 bulan')
    expect(formatUmurBulan(23.5)).not.toContain('.')
  })

  it('nilai kosong tidak menjadi angka', () => {
    expect(formatUmurBulan(null)).toBe('-')
    expect(formatUmurBulan(Number.NaN)).toBe('-')
  })
})
