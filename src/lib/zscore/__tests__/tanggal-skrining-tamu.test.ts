import { describe, expect, it } from 'vitest'
import {
  formatUmurKalender,
  periksaTanggalSebelumnya,
  periksaTanggalSkrining,
} from '@/lib/validasi/tanggal-skrining'
import { hitungVelocity } from '@/lib/zscore'

const HARI_INI = '2026-11-21'

describe('periksaTanggalSkrining (temuan uji produksi 21 November 2026)', () => {
  it('tanggal lahir kosong ditolak', () => {
    expect(periksaTanggalSkrining({ tanggalLahir: '', tanggalPeriksa: HARI_INI, hariIni: HARI_INI }))
      .toBe('Tanggal lahir belum diisi.')
  })

  it('tanggal setengah ketik ditolak tanpa melempar', () => {
    expect(periksaTanggalSkrining({ tanggalLahir: '0002-01-01', tanggalPeriksa: HARI_INI, hariIni: HARI_INI }))
      .toMatch(/tidak masuk akal/)
  })

  it('tanggal periksa di masa depan ditolak', () => {
    expect(periksaTanggalSkrining({ tanggalLahir: '2025-01-01', tanggalPeriksa: '2030-01-01', hariIni: HARI_INI }))
      .toBe('Tanggal periksa tidak boleh melewati hari ini.')
  })

  it('hari ini yang belum diketahui tidak menolak apa pun', () => {
    expect(periksaTanggalSkrining({ tanggalLahir: '2025-01-01', tanggalPeriksa: '2026-12-01', hariIni: '' }))
      .toBeNull()
  })

  it('tanggal lahir sesudah tanggal periksa ditolak', () => {
    expect(periksaTanggalSkrining({ tanggalLahir: '2026-12-01', tanggalPeriksa: HARI_INI, hariIni: '2026-12-31' }))
      .toBe('Tanggal lahir tidak boleh sesudah tanggal periksa.')
  })

  it('lahir hari ini dan periksa hari ini sah', () => {
    expect(periksaTanggalSkrining({ tanggalLahir: HARI_INI, tanggalPeriksa: HARI_INI, hariIni: HARI_INI }))
      .toBeNull()
  })
})

describe('periksaTanggalSebelumnya', () => {
  const dasar = { tanggalLahir: '2025-06-01', tanggalPeriksa: HARI_INI }
  it('kosong ditolak', () => {
    expect(periksaTanggalSebelumnya({ ...dasar, tanggalSebelumnya: '' })).toMatch(/belum diisi/)
  })
  it('sebelum lahir ditolak', () => {
    expect(periksaTanggalSebelumnya({ ...dasar, tanggalSebelumnya: '2025-05-01' })).toMatch(/sebelum tanggal lahir/)
  })
  it('sama dengan tanggal periksa ditolak', () => {
    expect(periksaTanggalSebelumnya({ ...dasar, tanggalSebelumnya: HARI_INI })).toMatch(/harus sebelum/)
  })
  it('satu bulan sebelumnya sah', () => {
    expect(periksaTanggalSebelumnya({ ...dasar, tanggalSebelumnya: '2026-10-21' })).toBeNull()
  })
})

describe('formatUmurKalender', () => {
  it('umur biasa', () => {
    expect(formatUmurKalender('2025-09-18', '2026-11-21')).toBe('1 Thn 2 Bln 3 Hr (429 Hari)')
  })
  it('akhir bulan dipinjam dari bulan sebelumnya', () => {
    expect(formatUmurKalender('2026-01-31', '2026-03-01')).toBe('1 Bln 1 Hr (29 Hari)')
  })
  it('usia koreksi negatif tidak lagi tampil sebagai umur negatif', () => {
    const teks = formatUmurKalender('2026-12-04', '2026-11-21')
    expect(teks).toBe('Belum cukup bulan (kurang 13 hari menuju 40 minggu)')
    expect(teks).not.toMatch(/-\d/)
  })
  it('tanggal tidak sah menjadi tanda pisah', () => {
    expect(formatUmurKalender('', '2026-11-21')).toBe('—')
  })
})

/**
 * Ambang P5 kenaikan berat diverifikasi terhadap seluruh tabel WHO di
 * velocity.test.ts. Uji di bawah memastikan alur yang dipakai Skrining Tamu
 * (tanggal lahir efektif, dua penimbangan) memberi status yang benar.
 */
describe('evaluasi kenaikan berat pada alur Skrining Tamu', () => {
  const dasar = { tanggalLahir: '2025-11-21', jenisKelamin: 'lk' as const, tanggalAwal: '2026-10-21', tanggalAkhir: HARI_INI }

  it('kenaikan nol tidak pernah dinyatakan naik', () => {
    const v = hitungVelocity({ ...dasar, beratAwalKg: 9, beratAkhirKg: 9 })
    expect(v.status).toBe('tidak_naik')
  })

  it('kenaikan 300 g dalam sebulan pada umur 11 bulan dinyatakan naik', () => {
    const v = hitungVelocity({ ...dasar, beratAwalKg: 9, beratAkhirKg: 9.3 })
    expect(v.metode).toBe('who_velocity')
    expect(v.status).toBe('naik')
  })

  it('jarak timbang 10 hari tidak dinilai', () => {
    const v = hitungVelocity({ ...dasar, tanggalAwal: '2026-11-11', beratAwalKg: 9, beratAkhirKg: 9.1 })
    expect(v.alasan).toBe('jarak_terlalu_rapat')
  })
})
