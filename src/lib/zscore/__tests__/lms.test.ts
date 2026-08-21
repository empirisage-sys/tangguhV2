import { describe, expect, it } from 'vitest'
import {
  batasTabel,
  bulatkanZ,
  hitungZ,
  interpolasiLms,
  lmsUntukKurva,
  nilaiDariLms,
} from '@/lib/zscore/lms'
import {
  LANGKAH_PANJANG_CM,
  LANGKAH_UMUR_BULAN,
  tabelPanjang,
  tabelUmur,
} from '@/lib/who'

describe('kelengkapan tabel referensi WHO', () => {
  it('BB/U dan TB/U mencakup 0 sampai 60 bulan tanpa baris hilang', () => {
    for (const seks of ['lk', 'pr'] as const) {
      for (const ind of ['bbu', 'tbu'] as const) {
        const tabel = tabelUmur(ind, seks)
        expect(Object.keys(tabel)).toHaveLength(61)
        expect(batasTabel(tabel)).toEqual({ min: 0, maks: 60 })
        for (let bulan = 0; bulan <= 60; bulan += 1) {
          expect(tabel[bulan], `${ind} ${seks} bulan ${bulan}`).toBeDefined()
        }
      }
    }
  })

  it('BB/PB mencakup 45 sampai 110 cm dan BB/TB mencakup 65 sampai 120 cm, langkah 0,5 cm', () => {
    for (const seks of ['lk', 'pr'] as const) {
      const bbpb = tabelPanjang('bbpb', seks)
      expect(Object.keys(bbpb)).toHaveLength(131)
      expect(batasTabel(bbpb)).toEqual({ min: 45, maks: 110 })

      const bbtb = tabelPanjang('bbtb', seks)
      expect(Object.keys(bbtb)).toHaveLength(111)
      expect(batasTabel(bbtb)).toEqual({ min: 65, maks: 120 })
    }
  })

  it('seluruh nilai L pada tabel TB/U sama dengan 1, sehingga distribusinya normal', () => {
    for (const seks of ['lk', 'pr'] as const) {
      const tabel = tabelUmur('tbu', seks)
      for (const kunci of Object.keys(tabel)) {
        expect(tabel[Number(kunci)]?.[0]).toBe(1)
      }
    }
  })

  it('median TB/U meningkat monoton, prasyarat pencarian usia-tinggi', () => {
    for (const seks of ['lk', 'pr'] as const) {
      const tabel = tabelUmur('tbu', seks)
      for (let bulan = 1; bulan <= 60; bulan += 1) {
        const sebelum = tabel[bulan - 1]?.[1] as number
        const kini = tabel[bulan]?.[1] as number
        expect(kini, `TB/U ${seks} bulan ${bulan}`).toBeGreaterThan(sebelum)
      }
    }
  })

  it('tabel TB/U memuat peralihan basis panjang ke tinggi pada bulan ke-24', () => {
    // Bulan 23 masih basis panjang terlentang, bulan 24 sudah basis tinggi berdiri.
    // Selisih 23 ke 24 karena itu jauh lebih kecil daripada selisih 24 ke 25.
    const lk = tabelUmur('tbu', 'lk')
    const m23 = lk[23]?.[1] as number
    const m24 = lk[24]?.[1] as number
    const m25 = lk[25]?.[1] as number

    expect(m23).toBeCloseTo(86.941, 3)
    expect(m24).toBeCloseTo(87.1161, 4)
    expect(m24 - m23).toBeLessThan(0.3)
    expect(m25 - m24).toBeGreaterThan(0.7)
  })
})

describe('interpolasiLms', () => {
  const tabel = tabelUmur('bbu', 'lk')

  it('mengembalikan baris tepat ketika nilai jatuh pada baris tabel', () => {
    const { lms, diLuarRentang } = interpolasiLms(24, tabel, LANGKAH_UMUR_BULAN)
    expect(diLuarRentang).toBe(false)
    expect(lms).toEqual(tabel[24])
  })

  it('menginterpolasi linear di antara dua baris', () => {
    const { lms } = interpolasiLms(24.5, tabel, LANGKAH_UMUR_BULAN)
    const a = tabel[24] as readonly [number, number, number]
    const b = tabel[25] as readonly [number, number, number]
    expect(lms?.[0]).toBeCloseTo((a[0] + b[0]) / 2, 10)
    expect(lms?.[1]).toBeCloseTo((a[1] + b[1]) / 2, 10)
    expect(lms?.[2]).toBeCloseTo((a[2] + b[2]) / 2, 10)
  })

  it('menangani langkah 0,5 cm pada tabel BB/TB', () => {
    const bbtb = tabelPanjang('bbtb', 'pr')
    const { lms, diLuarRentang } = interpolasiLms(87.5, bbtb, LANGKAH_PANJANG_CM)
    expect(diLuarRentang).toBe(false)
    expect(lms).toEqual(bbtb[87.5])

    const antara = interpolasiLms(87.25, bbtb, LANGKAH_PANJANG_CM)
    const a = bbtb[87] as readonly [number, number, number]
    const b = bbtb[87.5] as readonly [number, number, number]
    expect(antara.lms?.[1]).toBeCloseTo((a[1] + b[1]) / 2, 10)
  })

  it('MENOLAK nilai di luar rentang, tidak menjepit ke tepi tabel', () => {
    // Perilaku ini berbeda dari aplikasi lama, yang mengembalikan baris bulan ke-60.
    expect(interpolasiLms(61, tabel, LANGKAH_UMUR_BULAN)).toEqual({
      lms: null,
      diLuarRentang: true,
    })
    expect(interpolasiLms(-1, tabel, LANGKAH_UMUR_BULAN)).toEqual({
      lms: null,
      diLuarRentang: true,
    })

    const bbpb = tabelPanjang('bbpb', 'lk')
    expect(interpolasiLms(44.9, bbpb, LANGKAH_PANJANG_CM).lms).toBeNull()
    expect(interpolasiLms(110.1, bbpb, LANGKAH_PANJANG_CM).lms).toBeNull()
  })

  it('menerima nilai tepat di batas tabel', () => {
    const bbpb = tabelPanjang('bbpb', 'lk')
    expect(interpolasiLms(45, bbpb, LANGKAH_PANJANG_CM).lms).toEqual(bbpb[45])
    expect(interpolasiLms(110, bbpb, LANGKAH_PANJANG_CM).lms).toEqual(bbpb[110])

    const bbtb = tabelPanjang('bbtb', 'pr')
    expect(interpolasiLms(65, bbtb, LANGKAH_PANJANG_CM).lms).toEqual(bbtb[65])
    expect(interpolasiLms(120, bbtb, LANGKAH_PANJANG_CM).lms).toEqual(bbtb[120])
  })

  it('lmsUntukKurva menjepit nilai, hanya untuk menggambar garis', () => {
    expect(lmsUntukKurva(75, tabel, LANGKAH_UMUR_BULAN)).toEqual(tabel[60])
    expect(lmsUntukKurva(-5, tabel, LANGKAH_UMUR_BULAN)).toEqual(tabel[0])
  })
})

describe('hitungZ', () => {
  it('rumus LMS baku berlaku pada rentang -3 sampai +3 SD', () => {
    const lms = tabelUmur('bbu', 'lk')[24] as readonly [number, number, number]
    const [L, M, S] = lms
    // Nilai pada z = -1 dihitung balik, lalu Z-nya harus kembali -1.
    const nilai = M * Math.pow(1 + L * S * -1, 1 / L)
    expect(hitungZ(nilai, lms)).toBeCloseTo(-1, 9)
  })

  it('median menghasilkan Z nol', () => {
    const lms = tabelUmur('bbu', 'pr')[36] as readonly [number, number, number]
    expect(hitungZ(lms[1], lms)).toBeCloseTo(0, 9)
  })

  it('koreksi WHO aktif di luar 3 SD dan berbeda dari rumus LMS mentah', () => {
    const lms = tabelPanjang('bbtb', 'lk')[85] as readonly [number, number, number]
    const [L, M, S] = lms
    const sd3 = nilaiDariLms(lms, 3)
    const sd2 = nilaiDariLms(lms, 2)

    // Anak dengan berat satu "lebar SD" di atas SD3 harus tepat berada di Z = 4.
    const berat = sd3 + (sd3 - sd2)
    expect(hitungZ(berat, lms)).toBeCloseTo(4, 6)

    const mentah = (Math.pow(berat / M, L) - 1) / (L * S)
    expect(Math.abs(mentah - 4)).toBeGreaterThan(0.05)
  })

  it('koreksi WHO berlaku simetris di bawah -3 SD', () => {
    const lms = tabelPanjang('bbtb', 'pr')[85] as readonly [number, number, number]
    const sd3 = nilaiDariLms(lms, -3)
    const sd2 = nilaiDariLms(lms, -2)
    const berat = sd3 - (sd2 - sd3)
    expect(hitungZ(berat, lms)).toBeCloseTo(-4, 6)
  })

  it('koreksi tidak mengubah hasil pada TB/U karena nilai L sama dengan 1', () => {
    // Ini yang membuat penerapan koreksi pada TB/U aman untuk dipertahankan.
    const lms = tabelUmur('tbu', 'lk')[30] as readonly [number, number, number]
    const [, M, S] = lms
    for (const zTarget of [3.5, 4, 5, -3.5, -4, -5]) {
      const tinggi = M * (1 + S * zTarget)
      expect(hitungZ(tinggi, lms)).toBeCloseTo(zTarget, 9)
    }
  })

  it('menolak masukan tidak sahih', () => {
    const lms = tabelUmur('bbu', 'lk')[12] as readonly [number, number, number]
    expect(hitungZ(0, lms)).toBeNull()
    expect(hitungZ(-5, lms)).toBeNull()
    expect(hitungZ(Number.NaN, lms)).toBeNull()
    expect(hitungZ(10, null)).toBeNull()
  })

  it('bulatkanZ menyimpan tiga desimal', () => {
    expect(bulatkanZ(-2.34567)).toBe(-2.346)
    expect(bulatkanZ(null)).toBeNull()
  })
})
