import { describe, expect, it } from 'vitest'
import {
  HARI_PER_BULAN,
  hitungUmur,
  hitungUmurKalender,
  hitungUsiaKoreksi,
  keHariEpoch,
  selisihHari,
  TanggalTidakValidError,
} from '@/lib/zscore/umur'
import {
  klasifikasiBBTB,
  klasifikasiBBU,
  klasifikasiTBU,
  perluIntervensiGizi,
} from '@/lib/zscore/klasifikasi'

describe('perhitungan umur', () => {
  it('menghitung selisih hari secara tepat', () => {
    expect(selisihHari('2026-01-01', '2026-01-01')).toBe(0)
    expect(selisihHari('2026-01-01', '2026-01-02')).toBe(1)
    expect(selisihHari('2026-01-01', '2027-01-01')).toBe(365)
    expect(selisihHari('2024-01-01', '2025-01-01')).toBe(366) // tahun kabisat
  })

  it('tidak bergeser satu hari karena zona waktu', () => {
    // Ini yang gagal bila memakai new Date() pada string bertanda waktu.
    // Di zona waktu Indonesia, pergeseran satu hari mengubah Z-Score bayi baru lahir.
    expect(selisihHari('2026-03-01', '2026-03-31')).toBe(30)
    expect(selisihHari('2026-12-31', '2027-01-01')).toBe(1)
    expect(keHariEpoch('1970-01-01')).toBe(0)
    expect(keHariEpoch('1970-01-02')).toBe(1)
  })

  it('umur bulan memakai konvensi 30,4375 hari', () => {
    expect(HARI_PER_BULAN).toBe(30.4375)
    const umur = hitungUmur('2026-01-01', '2026-01-31')
    expect(umur.hari).toBe(30)
    expect(umur.bulan).toBeCloseTo(30 / 30.4375, 10)
  })

  it('menyusun tampilan tahun dan bulan', () => {
    const umur = hitungUmur('2023-01-01', '2026-02-15')
    expect(umur.tampilan.tahun).toBe(3)
    expect(umur.tampilan.bulanSisa).toBeGreaterThanOrEqual(1)
  })

  it('menolak format tanggal yang salah', () => {
    expect(() => keHariEpoch('01-01-2026')).toThrow(TanggalTidakValidError)
    expect(() => keHariEpoch('2026-1-1')).toThrow(TanggalTidakValidError)
    expect(() => keHariEpoch('2026-01-01T00:00:00Z')).toThrow(TanggalTidakValidError)
    expect(() => keHariEpoch('')).toThrow(TanggalTidakValidError)
  })

  it('menolak tanggal yang tidak ada dalam kalender', () => {
    expect(() => keHariEpoch('2026-02-30')).toThrow(TanggalTidakValidError)
    expect(() => keHariEpoch('2026-13-01')).toThrow(TanggalTidakValidError)
    expect(() => keHariEpoch('2025-02-29')).toThrow(TanggalTidakValidError)
    expect(keHariEpoch('2024-02-29')).toBeTypeOf('number') // 2024 kabisat
  })

  it('umur negatif tetap dihitung agar dapat ditolak di lapisan atas', () => {
    expect(hitungUmur('2026-06-01', '2026-05-01').hari).toBeLessThan(0)
  })

  it('menghitung umur kalender Tahun, Bulan, Hari secara akurat', () => {
    const umur = hitungUmurKalender('2024-06-01', '2026-08-20')
    expect(umur.tahun).toBe(2)
    expect(umur.bulan).toBe(2)
    expect(umur.hari).toBe(19)
    expect(umur.totalHari).toBe(810)
    expect(umur.teks).toBe('2 Tahun 2 Bulan 19 Hari')
  })

  it('menghitung koreksi usia prematuritas', () => {
    // Lahir 32 minggu (defisit 8 minggu / 56 hari)
    const koreksi = hitungUsiaKoreksi('2024-06-01', '2026-08-20', 32)
    expect(koreksi.isPrematur).toBe(true)
    expect(koreksi.defisitMinggu).toBe(8)
    expect(koreksi.defisitHari).toBe(56)
    expect(koreksi.umurKronologis.teks).toBe('2 Tahun 2 Bulan 19 Hari')
    expect(koreksi.umurKoreksi.tahun).toBe(2)
    expect(koreksi.umurKoreksi.bulan).toBe(0)
    expect(koreksi.umurKoreksi.hari).toBe(24)
    expect(koreksi.umurKoreksi.totalHari).toBe(754)
  })

  it('mengabaikan usia koreksi bila usia gestasi >= 37 minggu (aterm)', () => {
    const aterm = hitungUsiaKoreksi('2024-06-01', '2026-08-20', 39)
    expect(aterm.isPrematur).toBe(false)
    expect(aterm.defisitMinggu).toBe(0)
    expect(aterm.umurKoreksi.teks).toBe(aterm.umurKronologis.teks)
  })
})

describe('klasifikasi BB/U', () => {
  it('menerapkan ambang standar Kemenkes', () => {
    expect(klasifikasiBBU(-3.01)).toBe('berat_badan_sangat_kurang')
    expect(klasifikasiBBU(-3)).toBe('berat_badan_kurang') // -3 masuk kategori kurang
    expect(klasifikasiBBU(-2.5)).toBe('berat_badan_kurang')
    expect(klasifikasiBBU(-2)).toBe('berat_badan_normal') // -2 masuk kategori normal
    expect(klasifikasiBBU(0)).toBe('berat_badan_normal')
    expect(klasifikasiBBU(1)).toBe('berat_badan_normal') // +1 masih normal
    expect(klasifikasiBBU(1.01)).toBe('risiko_berat_badan_lebih')
    expect(klasifikasiBBU(null)).toBeNull()
  })
})

describe('klasifikasi TB/U', () => {
  it('menerapkan ambang standar Kemenkes: normal berlaku sampai +3 SD', () => {
    expect(klasifikasiTBU(-3.01)).toBe('sangat_pendek')
    expect(klasifikasiTBU(-3)).toBe('pendek')
    expect(klasifikasiTBU(-2.01)).toBe('pendek')
    expect(klasifikasiTBU(-2)).toBe('normal')
    expect(klasifikasiTBU(0)).toBe('normal')
    expect(klasifikasiTBU(3)).toBe('normal')
    expect(klasifikasiTBU(3.01)).toBe('tinggi')
  })

  it('PERBEDAAN DENGAN APLIKASI LAMA: Z antara +2 dan +3 kini normal, bukan tinggi', () => {
    // Aplikasi versi Firebase menyebut rentang ini "Tinggi".
    expect(klasifikasiTBU(2.5)).toBe('normal')
    expect(klasifikasiTBU(2.01)).toBe('normal')
    expect(klasifikasiTBU(2.99)).toBe('normal')
  })

  it('tidak mengenal kategori sangat tinggi', () => {
    expect(klasifikasiTBU(5)).toBe('tinggi')
    expect(klasifikasiTBU(10)).toBe('tinggi')
  })
})

describe('klasifikasi BB/TB', () => {
  it('menerapkan enam kategori standar Kemenkes', () => {
    expect(klasifikasiBBTB(-3.01)).toBe('gizi_buruk')
    expect(klasifikasiBBTB(-3)).toBe('gizi_kurang')
    expect(klasifikasiBBTB(-2.01)).toBe('gizi_kurang')
    expect(klasifikasiBBTB(-2)).toBe('gizi_baik')
    expect(klasifikasiBBTB(0)).toBe('gizi_baik')
    expect(klasifikasiBBTB(1)).toBe('gizi_baik')
    expect(klasifikasiBBTB(1.01)).toBe('risiko_gizi_lebih')
    expect(klasifikasiBBTB(2)).toBe('risiko_gizi_lebih')
    expect(klasifikasiBBTB(2.01)).toBe('gizi_lebih')
    expect(klasifikasiBBTB(3)).toBe('gizi_lebih')
    expect(klasifikasiBBTB(3.01)).toBe('obesitas')
  })
})

describe('penanda perlu intervensi gizi', () => {
  it('menangkap anak wasted meskipun BB/U masih normal', () => {
    // Kasus yang TERLEWAT oleh penyaring aplikasi lama, karena mencocokkan
    // teks 'Gizi kurang' dengan huruf k kecil terhadap label 'Gizi Kurang (Wasted)'.
    expect(perluIntervensiGizi('berat_badan_normal', 'normal', 'gizi_kurang')).toBe(true)
    expect(perluIntervensiGizi('berat_badan_normal', 'normal', 'gizi_buruk')).toBe(true)
  })

  it('menangkap anak stunted, bukan hanya sangat pendek', () => {
    // Penyaring dasbor dietisien lama hanya mencari 'Sangat Pendek'.
    expect(perluIntervensiGizi('berat_badan_normal', 'pendek', 'gizi_baik')).toBe(true)
  })

  it('tidak menandai anak berstatus baik', () => {
    expect(perluIntervensiGizi('berat_badan_normal', 'normal', 'gizi_baik')).toBe(false)
    expect(perluIntervensiGizi('risiko_berat_badan_lebih', 'tinggi', 'gizi_lebih')).toBe(false)
  })

  it('menangani indikator yang tidak dapat dinilai', () => {
    expect(perluIntervensiGizi(null, null, null)).toBe(false)
  })
})
