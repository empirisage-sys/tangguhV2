import { describe, expect, it } from 'vitest'
import {
  basisUntukUmur,
  GARIS_SD,
  jendelaPanjang,
  jendelaUmur,
  semuaKurva,
  seriBBTB,
  seriBBU,
  seriTBU,
  seriTrenZ,
  type KunjunganRiwayat,
} from '@/lib/grafik/seri'
import { hitungSkrining } from '@/lib/zscore'
import { langkahSumbu, renderKurvaSvg, renderTrenZSvg } from '@/lib/grafik/svg'

/** Menyusun riwayat dari daftar pengukuran, memakai engine sebenarnya. */
function riwayatDari(
  tanggalLahir: string,
  seks: 'lk' | 'pr',
  pengukuran: Array<{ tanggal: string; berat: number; panjang: number }>,
): KunjunganRiwayat[] {
  return pengukuran.map((p) => {
    const h = hitungSkrining({
      tanggalLahir,
      tanggalPeriksa: p.tanggal,
      jenisKelamin: seks,
      beratKg: p.berat,
      panjangCm: p.panjang,
      posisiUkur: 'otomatis',
    })
    return {
      tanggalPeriksa: p.tanggal,
      umurBulan: h.umurBulan,
      beratKg: p.berat,
      panjangTerkoreksiCm: h.panjangTerkoreksiCm,
      standarPanjang: h.standarPanjang,
      zBbu: h.bbu.z,
      zTbu: h.tbu.z,
      zBbtb: h.bbtb.z,
    }
  })
}

/** Riwayat lima kunjungan bulanan, anak laki-laki yang tumbuh melambat. */
const RIWAYAT_MELAMBAT = riwayatDari('2025-03-01', 'lk', [
  { tanggal: '2025-09-01', berat: 7.6, panjang: 67.5 },
  { tanggal: '2025-12-01', berat: 8.2, panjang: 70.5 },
  { tanggal: '2026-03-01', berat: 8.5, panjang: 72.5 },
  { tanggal: '2026-06-01', berat: 8.7, panjang: 74.0 },
  { tanggal: '2026-08-01', berat: 8.8, panjang: 75.0 },
])

describe('jendela tampilan', () => {
  it('mempersempit jendela umur ke sekitar riwayat anak', () => {
    // Menggambar 0 sampai 60 bulan membuat titik anak berdesakan di satu sudut.
    const [dari, sampai] = jendelaUmur(RIWAYAT_MELAMBAT)
    expect(dari).toBeGreaterThan(2)
    expect(sampai).toBeLessThan(24)
    expect(sampai).toBeGreaterThan(dari)
  })

  it('menjaga lebar minimum agar tren tetap terlihat pada satu kunjungan', () => {
    const satu = riwayatDari('2026-02-01', 'pr', [
      { tanggal: '2026-08-01', berat: 7.5, panjang: 66 },
    ])
    const [dari, sampai] = jendelaUmur(satu)
    expect(sampai - dari).toBeGreaterThanOrEqual(6)
  })

  it('tidak melewati batas cakupan standar 0 sampai 60 bulan', () => {
    const tua = riwayatDari('2021-09-01', 'lk', [
      { tanggal: '2026-08-01', berat: 17, panjang: 108 },
    ])
    const [dari, sampai] = jendelaUmur(tua)
    expect(dari).toBeGreaterThanOrEqual(0)
    expect(sampai).toBeLessThanOrEqual(60)
  })

  it('jendela panjang badan dibulatkan ke lima sentimeter dan tidak melewati batas tabel', () => {
    const [dari, sampai] = jendelaPanjang(RIWAYAT_MELAMBAT, 'bbpb')
    expect(dari % 5).toBe(0)
    expect(dari).toBeGreaterThanOrEqual(45)
    expect(sampai).toBeLessThanOrEqual(110)

    const [d2, s2] = jendelaPanjang(RIWAYAT_MELAMBAT, 'bbtb')
    expect(d2).toBeGreaterThanOrEqual(65)
    expect(s2).toBeLessThanOrEqual(120)
  })

  it('riwayat kosong tetap menghasilkan jendela yang sah', () => {
    const [dari, sampai] = jendelaUmur([])
    expect(sampai).toBeGreaterThan(dari)
  })
})

describe('kurva BB/U', () => {
  const seri = seriBBU(RIWAYAT_MELAMBAT, 'lk')

  it('menghasilkan lima garis rujukan pada setiap titik', () => {
    expect(GARIS_SD).toHaveLength(5)
    expect(seri.rujukan.length).toBeGreaterThan(10)
    for (const t of seri.rujukan) {
      expect(t.sd_n3).toBeLessThan(t.sd_n2)
      expect(t.sd_n2).toBeLessThan(t.sd_0)
      expect(t.sd_0).toBeLessThan(t.sd_p2)
      expect(t.sd_p2).toBeLessThan(t.sd_p3)
    }
  })

  it('garis rujukan naik monoton terhadap umur', () => {
    for (let i = 1; i < seri.rujukan.length; i += 1) {
      expect(seri.rujukan[i]?.sd_0).toBeGreaterThan(seri.rujukan[i - 1]?.sd_0 as number)
    }
  })

  it('titik anak berurutan menurut umur dan memakai berat badan sebagai sumbu tegak', () => {
    expect(seri.anak).toHaveLength(5)
    for (let i = 1; i < seri.anak.length; i += 1) {
      expect(seri.anak[i]?.x).toBeGreaterThan(seri.anak[i - 1]?.x as number)
    }
    expect(seri.anak[0]?.y).toBe(7.6)
    expect(seri.anak[4]?.y).toBe(8.8)
  })

  it('setiap titik menyimpan tanggal dan nilai Z untuk keterangan sentuh', () => {
    expect(seri.anak[0]?.tanggal).toBe('2025-09-01')
    expect(seri.anak[0]?.z).not.toBeNull()
  })

  it('domain tegak mencakup seluruh garis rujukan dan seluruh titik anak', () => {
    const [bawah, atas] = seri.domainY
    for (const t of seri.rujukan) {
      expect(t.sd_n3).toBeGreaterThanOrEqual(bawah)
      expect(t.sd_p3).toBeLessThanOrEqual(atas)
    }
    for (const t of seri.anak) {
      expect(t.y).toBeGreaterThanOrEqual(bawah)
      expect(t.y).toBeLessThanOrEqual(atas)
    }
  })

  it('label sumbu memakai bahasa Indonesia beserta satuannya', () => {
    expect(seri.labelX).toBe('Umur (bulan)')
    expect(seri.labelY).toBe('Berat badan (kg)')
  })
})

describe('kurva TB/U', () => {
  it('memakai panjang terkoreksi, bukan angka terukur mentah', () => {
    const berdiri = riwayatDari('2025-01-01', 'lk', [
      { tanggal: '2026-06-01', berat: 10, panjang: 80 },
    ])
    // Umur di bawah 24 bulan, jadi standarnya terlentang.
    expect(berdiri[0]?.standarPanjang).toBe('terlentang')
    const seri = seriTBU(berdiri, 'lk')
    expect(seri.anak[0]?.y).toBe(berdiri[0]?.panjangTerkoreksiCm)
  })

  it('memberi catatan bila jendela melewati umur 24 bulan', () => {
    const melintas = riwayatDari('2024-06-01', 'lk', [
      { tanggal: '2026-04-01', berat: 11, panjang: 84 },
      { tanggal: '2026-08-01', berat: 11.6, panjang: 86 },
    ])
    const seri = seriTBU(melintas, 'lk')
    expect(seri.domainX[0]).toBeLessThan(24)
    expect(seri.domainX[1]).toBeGreaterThanOrEqual(24)
    expect(seri.catatan.join(' ')).toContain('24 bulan')
    expect(seri.catatan.join(' ')).toContain('bukan tanda kesalahan')
  })

  it('tidak memberi catatan peralihan bila jendela tidak melewati 24 bulan', () => {
    const seri = seriTBU(RIWAYAT_MELAMBAT, 'lk')
    expect(seri.catatan.join(' ')).not.toContain('berpindah dari panjang badan')
  })
})

describe('kurva BB/TB', () => {
  it('memilih standar menurut umur pada pemeriksaan terakhir', () => {
    expect(basisUntukUmur(23.9)).toBe('bbpb')
    expect(basisUntukUmur(24)).toBe('bbtb')

    const muda = seriBBTB(RIWAYAT_MELAMBAT, 'lk')
    expect(muda.judul).toContain('panjang badan')

    const tua = riwayatDari('2023-01-01', 'lk', [
      { tanggal: '2026-08-01', berat: 13, panjang: 95 },
    ])
    expect(seriBBTB(tua, 'lk').judul).toContain('tinggi badan')
  })

  it('memakai panjang badan sebagai sumbu datar, bukan umur', () => {
    const seri = seriBBTB(RIWAYAT_MELAMBAT, 'lk')
    expect(seri.labelX).toContain('cm')
    expect(seri.anak[0]?.x).toBe(RIWAYAT_MELAMBAT[0]?.panjangTerkoreksiCm)
  })

  it('menjelaskan titik yang berasal dari standar berbeda, tidak menyembunyikannya', () => {
    // Riwayat yang melintasi umur 24 bulan memiliki titik dari dua standar.
    const melintas = riwayatDari('2024-06-01', 'lk', [
      { tanggal: '2026-02-01', berat: 10.5, panjang: 82 }, // sekitar 20 bulan, terlentang
      { tanggal: '2026-08-01', berat: 11.5, panjang: 86 }, // sekitar 26 bulan, berdiri
    ])
    const standar = new Set(melintas.map((r) => r.standarPanjang))
    expect(standar.size).toBe(2)

    const seri = seriBBTB(melintas, 'lk')
    const gabungan = seri.catatan.join(' ')
    expect(gabungan).toContain('standar yang lain')
    expect(gabungan).toContain('status gizi tidak terpengaruh')
  })

  it('tidak memberi catatan standar bila seluruh titik dari satu standar', () => {
    const seri = seriBBTB(RIWAYAT_MELAMBAT, 'lk')
    expect(seri.catatan.join(' ')).not.toContain('standar yang lain')
  })

  it('standar dapat dipaksa, untuk kebutuhan pembandingan', () => {
    const seri = seriBBTB(RIWAYAT_MELAMBAT, 'lk', 'bbtb')
    expect(seri.judul).toContain('tinggi badan')
    expect(seri.domainX[0]).toBeGreaterThanOrEqual(65)
  })
})

describe('tren nilai Z', () => {
  const tren = seriTrenZ(RIWAYAT_MELAMBAT)

  it('menampilkan ketiga indikator pada setiap titik', () => {
    expect(tren.titik).toHaveLength(5)
    for (const t of tren.titik) {
      expect(t.bbu).not.toBeUndefined()
      expect(t.tbu).not.toBeUndefined()
      expect(t.bbtb).not.toBeUndefined()
    }
  })

  it('domain tegak selalu memuat -3 dan +3 agar batas kewaspadaan terlihat', () => {
    expect(tren.domainY[0]).toBeLessThanOrEqual(-4)
    expect(tren.domainY[1]).toBeGreaterThanOrEqual(4)
  })

  it('melebar bila ada nilai Z di luar -4 sampai +4', () => {
    const ekstrem = riwayatDari('2025-08-01', 'lk', [
      { tanggal: '2026-08-01', berat: 5.5, panjang: 68 },
    ])
    const t = seriTrenZ(ekstrem)
    const zTerendah = Math.min(
      ...[t.titik[0]?.bbu, t.titik[0]?.tbu, t.titik[0]?.bbtb].filter(
        (z): z is number => typeof z === 'number',
      ),
    )
    expect(t.domainY[0]).toBeLessThanOrEqual(Math.floor(zTerendah))
  })

  it('menangkap pertumbuhan melambat meskipun berat badan terus bertambah', () => {
    // Inilah gunanya kurva ini: berat naik terus, tetapi nilai Z turun.
    const beratNaik = RIWAYAT_MELAMBAT.every(
      (r, i) => i === 0 || r.beratKg > (RIWAYAT_MELAMBAT[i - 1]?.beratKg as number),
    )
    expect(beratNaik).toBe(true)

    const zAwal = tren.titik[0]?.bbu as number
    const zAkhir = tren.titik[tren.titik.length - 1]?.bbu as number
    expect(zAkhir).toBeLessThan(zAwal)
  })

  it('mengingatkan bila tren belum dapat dinilai', () => {
    const satu = seriTrenZ([RIWAYAT_MELAMBAT[0] as KunjunganRiwayat])
    expect(satu.catatan.join(' ')).toContain('dua kali pengukuran')
  })
})

describe('catatan wajib', () => {
  it('satu kali pengukuran diberi keterangan bahwa arah pertumbuhan belum dapat dinilai', () => {
    const satu = riwayatDari('2026-02-01', 'pr', [
      { tanggal: '2026-08-01', berat: 7.5, panjang: 66 },
    ])
    const seri = seriBBU(satu, 'pr')
    expect(seri.catatan.join(' ')).toContain('satu kali pengukuran')
  })

  it('pengukuran di luar rentang dilaporkan, tidak dihilangkan diam-diam', () => {
    const campur: KunjunganRiwayat[] = [
      ...RIWAYAT_MELAMBAT,
      {
        tanggalPeriksa: '2026-08-15',
        umurBulan: 62,
        beratKg: 18,
        panjangTerkoreksiCm: 108,
        standarPanjang: 'berdiri',
        zBbu: null,
        zTbu: null,
        zBbtb: null,
      },
    ]
    const seri = seriBBU(campur, 'lk')
    expect(seri.catatan.join(' ')).toContain('di luar rentang')
  })
})

describe('penyusunan seluruh kurva', () => {
  it('menghasilkan keempat kurva sekaligus', () => {
    const semua = semuaKurva(RIWAYAT_MELAMBAT, 'lk')
    expect(semua.bbu.indikator).toBe('bbu')
    expect(semua.tbu.indikator).toBe('tbu')
    expect(semua.bbtb.indikator).toBe('bbtb')
    expect(semua.trenZ.titik).toHaveLength(5)
  })

  it('bekerja pada riwayat kosong tanpa melempar galat', () => {
    const semua = semuaKurva([], 'pr')
    expect(semua.bbu.anak).toHaveLength(0)
    expect(semua.bbu.rujukan.length).toBeGreaterThan(0)
    expect(semua.trenZ.titik).toHaveLength(0)
  })

  it('bekerja untuk kedua jenis kelamin dengan rujukan yang berbeda', () => {
    const lk = seriBBU(RIWAYAT_MELAMBAT, 'lk')
    const pr = seriBBU(RIWAYAT_MELAMBAT, 'pr')
    expect(lk.rujukan[0]?.sd_0).not.toBe(pr.rujukan[0]?.sd_0)
  })
})

describe('perender SVG', () => {
  const seri = seriBBU(RIWAYAT_MELAMBAT, 'lk')

  it('menghasilkan SVG yang sah dan mandiri', () => {
    const svg = renderKurvaSvg(seri)
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg.endsWith('</svg>')).toBe(true)
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"')
    expect(svg).toContain('viewBox="0 0 640 360"')
  })

  it('memuat kelima garis rujukan dan labelnya', () => {
    const svg = renderKurvaSvg(seri)
    expect((svg.match(/<polyline/g) ?? []).length).toBeGreaterThanOrEqual(5)
    for (const label of ['>-3<', '>-2<', '>0<', '>+2<', '>+3<']) {
      expect(svg).toContain(label)
    }
  })

  it('menggambar satu titik untuk setiap kunjungan', () => {
    const svg = renderKurvaSvg(seri)
    // Lima titik kunjungan ditambah satu lingkaran penanda kunjungan terakhir.
    expect((svg.match(/<circle/g) ?? []).length).toBe(seri.anak.length + 1)
  })

  it('setiap titik memuat tanggal dan nilai Z sebagai keterangan', () => {
    const svg = renderKurvaSvg(seri)
    expect(svg).toContain('<title>2025-09-01')
    expect(svg).toContain('Z -')
  })

  it('memuat label sumbu dan judul', () => {
    const svg = renderKurvaSvg(seri)
    expect(svg).toContain('Umur (bulan)')
    expect(svg).toContain('Berat badan (kg)')
    expect(svg).toContain('Berat badan menurut umur')
  })

  it('judul dapat disembunyikan bila sudah ditulis di luar SVG', () => {
    const svg = renderKurvaSvg(seri, { tanpaJudul: true })
    expect(svg).not.toContain('font-weight="700" fill="#0F2B31"')
  })

  it('menghindari penyuntikan lewat teks judul', () => {
    const jahat = { ...seri, judul: '<script>alert(1)</script>' }
    const svg = renderKurvaSvg(jahat)
    expect(svg).not.toContain('<script>')
    expect(svg).toContain('&lt;script&gt;')
  })

  it('bekerja pada riwayat kosong tanpa melempar galat', () => {
    const kosong = seriBBU([], 'pr')
    const svg = renderKurvaSvg(kosong)
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).not.toContain('<circle')
  })

  it('titik yang tidak dapat dinilai digambar berongga, bukan dihilangkan', () => {
    const campur: KunjunganRiwayat[] = [
      RIWAYAT_MELAMBAT[0] as KunjunganRiwayat,
      { ...(RIWAYAT_MELAMBAT[1] as KunjunganRiwayat), zBbu: null },
    ]
    const svg = renderKurvaSvg(seriBBU(campur, 'lk'))
    expect(svg).toContain('#FFFFFF" stroke="#A8BFC4')
  })

  it('langkah sumbu menghasilkan jumlah tanda yang wajar', () => {
    expect(langkahSumbu(6)).toBeLessThanOrEqual(1)
    expect(langkahSumbu(60)).toBeGreaterThanOrEqual(10)
    for (const rentang of [3, 6, 12, 24, 40, 60, 75]) {
      const n = rentang / langkahSumbu(rentang)
      expect(n).toBeLessThanOrEqual(8)
    }
  })

  it('tren Z memuat ketiga indikator beserta keterangan warnanya', () => {
    const svg = renderTrenZSvg(seriTrenZ(RIWAYAT_MELAMBAT))
    for (const label of ['BB/U', 'TB/U', 'BB/TB']) {
      expect(svg).toContain(label)
    }
    expect(svg).toContain('Umur (bulan)')
  })

  it('tren Z menandai zona di bawah -2 dan -3 simpang baku', () => {
    const svg = renderTrenZSvg(seriTrenZ(RIWAYAT_MELAMBAT))
    expect(svg).toContain('#FFF6E0')
    expect(svg).toContain('#FEECEC')
  })
})
