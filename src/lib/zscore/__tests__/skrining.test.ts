import { describe, expect, it } from 'vitest'
import {
  ENGINE_VERSION,
  hitungSkrining,
  koreksiPosisi,
  KOREKSI_POSISI_CM,
} from '@/lib/zscore'
import { rdaKkalPerKg, usiaTinggiBulan } from '@/lib/zscore/gizi'
import type { InputSkrining } from '@/lib/zscore/tipe'

/**
 * Menyusun masukan uji dengan nilai bawaan yang wajar.
 *
 * Tanggal periksa dipilih 732 hari setelah lahir, yaitu 24,05 bulan, agar
 * benar-benar berada di atas ambang 24 bulan. Lihat blok uji "batas 24 bulan"
 * di bawah: anak yang tepat berulang tahun kedua baru berumur 730 hari, yaitu
 * 23,98 bulan menurut konvensi 30,4375 hari per bulan.
 */
function input(ubah: Partial<InputSkrining> = {}): InputSkrining {
  return {
    tanggalLahir: '2024-08-19',
    tanggalPeriksa: '2026-08-21',
    jenisKelamin: 'lk',
    beratKg: 12,
    panjangCm: 87,
    posisiUkur: 'otomatis',
    ...ubah,
  }
}

describe('batas 24 bulan menurut konvensi hari per bulan', () => {
  it('anak yang tepat berulang tahun kedua masih memakai standar terlentang', () => {
    // 24 bulan setara 730,5 hari. Dua tahun kalender hanya 730 hari, sehingga
    // pada hari ulang tahun kedua umur tercatat 23,98 bulan.
    // Peralihan standar terjadi pada hari ke-731, bukan pada hari ulang tahun.
    // Perilaku ini sama dengan aplikasi versi Firebase dan sejalan dengan
    // WHO Anthro, yang juga memakai ambang 730,5 hari.
    const ulangTahunKedua = hitungSkrining({
      tanggalLahir: '2024-08-19',
      tanggalPeriksa: '2026-08-19', // 730 hari
      jenisKelamin: 'lk',
      beratKg: 12,
      panjangCm: 87,
      posisiUkur: 'otomatis',
    })
    expect(ulangTahunKedua.umurHari).toBe(730)
    expect(ulangTahunKedua.umurBulan).toBeLessThan(24)
    expect(ulangTahunKedua.standarPanjang).toBe('terlentang')
    expect(ulangTahunKedua.bbtb.keterangan).toContain('BB/PB')

    const sehariKemudian = hitungSkrining({
      tanggalLahir: '2024-08-19',
      tanggalPeriksa: '2026-08-20', // 731 hari
      jenisKelamin: 'lk',
      beratKg: 12,
      panjangCm: 87,
      posisiUkur: 'otomatis',
    })
    expect(sehariKemudian.umurHari).toBe(731)
    expect(sehariKemudian.umurBulan).toBeGreaterThanOrEqual(24)
    expect(sehariKemudian.standarPanjang).toBe('berdiri')
    expect(sehariKemudian.bbtb.keterangan).toContain('BB/TB')
  })

  it('berat ideal berubah saat standar berpindah, karena tabelnya berbeda', () => {
    // Ini konsekuensi yang perlu diketahui pengguna: pada tinggi yang sama,
    // median BB/PB dan median BB/TB tidak identik.
    const dasar = {
      tanggalLahir: '2024-08-19',
      jenisKelamin: 'lk' as const,
      beratKg: 8,
      panjangCm: 78,
      posisiUkur: 'otomatis' as const,
    }
    const sebelum = hitungSkrining({ ...dasar, tanggalPeriksa: '2026-08-19' })
    const sesudah = hitungSkrining({ ...dasar, tanggalPeriksa: '2026-08-20' })

    expect(sebelum.gizi.beratIdealKg).toBeCloseTo(10.08, 2) // median BB/PB pada 78 cm
    expect(sesudah.gizi.beratIdealKg).toBeCloseTo(10.21, 2) // median BB/TB pada 78 cm
  })
})

describe('versi engine', () => {
  it('mencatat versi 2 karena perilakunya berbeda dari aplikasi lama', () => {
    expect(ENGINE_VERSION).toBe('zscore-2.0.0')
    expect(hitungSkrining(input()).engineVersion).toBe('zscore-2.0.0')
  })
})

describe('koreksi posisi pengukuran', () => {
  it('standar terlentang berlaku di bawah 24 bulan', () => {
    const hasil = koreksiPosisi(80, 23.99, 'berdiri')
    expect(hasil.standar).toBe('terlentang')
    expect(hasil.koreksiCm).toBe(KOREKSI_POSISI_CM)
    expect(hasil.panjangTerkoreksiCm).toBe(80.7)
  })

  it('standar berdiri berlaku tepat pada 24 bulan', () => {
    const hasil = koreksiPosisi(80, 24, 'terlentang')
    expect(hasil.standar).toBe('berdiri')
    expect(hasil.koreksiCm).toBe(-KOREKSI_POSISI_CM)
    expect(hasil.panjangTerkoreksiCm).toBe(79.3)
  })

  it('tidak mengoreksi bila posisi sudah sesuai standar', () => {
    expect(koreksiPosisi(80, 12, 'terlentang').koreksiCm).toBe(0)
    expect(koreksiPosisi(90, 30, 'berdiri').koreksiCm).toBe(0)
  })

  it('posisi otomatis berarti pengukur mengikuti standar, tanpa koreksi', () => {
    expect(koreksiPosisi(80, 12, 'otomatis').koreksiCm).toBe(0)
    expect(koreksiPosisi(90, 30, 'otomatis').koreksiCm).toBe(0)
  })

  it('titik peralihan tepat pada 24,00 bulan, diuji dari kedua sisi', () => {
    expect(koreksiPosisi(85, 23.999999, 'berdiri').koreksiCm).toBe(KOREKSI_POSISI_CM)
    expect(koreksiPosisi(85, 24.000001, 'berdiri').koreksiCm).toBe(0)
  })
})

describe('pemilihan tabel BB/PB dan BB/TB', () => {
  it('anak di bawah 24 bulan dinilai dengan BB/PB', () => {
    const hasil = hitungSkrining(input({ tanggalLahir: '2025-08-19', panjangCm: 80 }))
    expect(hasil.standarPanjang).toBe('terlentang')
    expect(hasil.bbtb.keterangan).toContain('BB/PB')
  })

  it('anak 24 bulan ke atas dinilai dengan BB/TB', () => {
    const hasil = hitungSkrining(input({ panjangCm: 87 }))
    expect(hasil.standarPanjang).toBe('berdiri')
    expect(hasil.bbtb.keterangan).toContain('BB/TB')
  })

  it('beralih ke BB/TB bila panjang terkoreksi melampaui 110 cm', () => {
    // Kasus pengaman: anak di bawah 24 bulan yang sangat panjang.
    const hasil = hitungSkrining(
      input({ tanggalLahir: '2025-08-19', panjangCm: 112, beratKg: 20 }),
    )
    expect(hasil.standarPanjang).toBe('terlentang')
    expect(hasil.bbtb.keterangan).toContain('BB/TB')
    expect(hasil.bbtb.z).not.toBeNull()
  })

  it('beralih ke BB/PB bila tinggi terkoreksi di bawah 65 cm', () => {
    const hasil = hitungSkrining(input({ panjangCm: 63, beratKg: 6 }))
    expect(hasil.standarPanjang).toBe('berdiri')
    expect(hasil.bbtb.keterangan).toContain('BB/PB')
    expect(hasil.bbtb.z).not.toBeNull()
  })
})

describe('penolakan nilai di luar rentang', () => {
  it('umur di atas 60 bulan ditolak, tidak dijepit ke bulan ke-60', () => {
    const hasil = hitungSkrining(
      input({ tanggalLahir: '2021-01-01', tanggalPeriksa: '2026-08-19' }),
    )
    expect(hasil.umurBulan).toBeGreaterThan(60)
    expect(hasil.diLuarRentang).toBe(true)
    expect(hasil.alasanDiLuarRentang).toContain('umur_melebihi_60_bulan')
    expect(hasil.bbu.z).toBeNull()
    expect(hasil.tbu.z).toBeNull()
    expect(hasil.statusTBU).toBeNull()
    expect(hasil.catatanDiLuarRentang).toContain('0-60 bulan')
  })

  it('umur tepat 60 bulan masih dinilai', () => {
    // 60 bulan setara sekitar 1826 hari.
    const hasil = hitungSkrining(
      input({ tanggalLahir: '2021-08-20', tanggalPeriksa: '2026-08-19', panjangCm: 110, beratKg: 18 }),
    )
    expect(hasil.umurBulan).toBeLessThanOrEqual(60)
    expect(hasil.diLuarRentang).toBe(false)
    expect(hasil.tbu.z).not.toBeNull()
  })

  it('tanggal periksa mendahului tanggal lahir ditolak', () => {
    const hasil = hitungSkrining(
      input({ tanggalLahir: '2026-08-19', tanggalPeriksa: '2026-01-01' }),
    )
    expect(hasil.umurHari).toBeLessThan(0)
    expect(hasil.alasanDiLuarRentang).toContain('umur_negatif')
    expect(hasil.bbu.z).toBeNull()
  })

  it('berat di luar batas wajar ditolak dengan penjelasan', () => {
    const berat = hitungSkrining(input({ beratKg: 55 }))
    expect(berat.alasanDiLuarRentang).toContain('berat_di_luar_batas_wajar')
    expect(berat.bbu.z).toBeNull()
    expect(berat.bbtb.z).toBeNull()
    expect(berat.catatanDiLuarRentang).toContain('Periksa kembali')

    const ringan = hitungSkrining(input({ beratKg: 0.2 }))
    expect(ringan.alasanDiLuarRentang).toContain('berat_di_luar_batas_wajar')
  })

  it('panjang di luar rentang tabel membuat BB/TB tidak dapat dinilai, tetapi TB/U tetap terhitung', () => {
    const hasil = hitungSkrining(input({ panjangCm: 125, beratKg: 25 }))
    expect(hasil.bbtb.z).toBeNull()
    expect(hasil.alasanDiLuarRentang).toContain('panjang_di_luar_tabel')
    expect(hasil.tbu.z).not.toBeNull() // TB/U berbasis umur, bukan tabel panjang
  })
})

describe('penandaan red flag', () => {
  it('menandai gizi buruk dan menyebutkan alasannya', () => {
    // Anak 24 bulan, tinggi 87 cm, berat 8 kg -> BB/TB jauh di bawah -3 SD.
    const hasil = hitungSkrining(input({ beratKg: 8, panjangCm: 87 }))
    expect(hasil.statusBBTB).toBe('gizi_buruk')
    expect(hasil.isRedFlag).toBe(true)
    expect(hasil.alasanRedFlag.join(' ')).toContain('Gizi buruk')
  })

  it('menandai sangat pendek', () => {
    const hasil = hitungSkrining(input({ panjangCm: 75, beratKg: 9 }))
    expect(hasil.statusTBU).toBe('sangat_pendek')
    expect(hasil.isRedFlag).toBe(true)
  })

  it('menandai edema meskipun seluruh indikator antropometri normal', () => {
    const tanpa = hitungSkrining(input())
    expect(tanpa.isRedFlag).toBe(false)

    const dengan = hitungSkrining(input({ edema: true }))
    expect(dengan.isRedFlag).toBe(true)
    expect(dengan.alasanRedFlag.join(' ')).toContain('Edema')
  })

  it('menandai LILA di bawah 11,5 cm pada umur 6 bulan ke atas', () => {
    const hasil = hitungSkrining(input({ lilaCm: 11 }))
    expect(hasil.isRedFlag).toBe(true)
    expect(hasil.alasanRedFlag.join(' ')).toContain('LILA')
  })

  it('anak sehat tidak ditandai', () => {
    const hasil = hitungSkrining(input({ beratKg: 12.2, panjangCm: 87.1 }))
    expect(hasil.isRedFlag).toBe(false)
    expect(hasil.alasanRedFlag).toHaveLength(0)
  })
})

describe('tabel RDA', () => {
  it('memakai ambang umur yang sama dengan aplikasi lama', () => {
    expect(rdaKkalPerKg(0)).toBe(110)
    expect(rdaKkalPerKg(12)).toBe(110)
    expect(rdaKkalPerKg(12.1)).toBe(100)
    expect(rdaKkalPerKg(36)).toBe(100)
    expect(rdaKkalPerKg(36.1)).toBe(90)
    expect(rdaKkalPerKg(60)).toBe(90)
  })
})

describe('usia-tinggi', () => {
  it('menghasilkan pecahan bulan, bukan bilangan bulat', () => {
    const usia = usiaTinggiBulan(78, 'lk')
    expect(usia).not.toBeNull()
    expect(usia as number).toBeGreaterThan(13)
    expect(usia as number).toBeLessThan(16)
    // Aplikasi lama selalu menghasilkan bilangan bulat.
    expect(Number.isInteger(usia as number)).toBe(false)
  })

  it('mengembalikan umur yang mediannya setara tinggi anak', () => {
    // Median TB/U laki-laki bulan ke-24 adalah 87,1161 cm.
    const usia = usiaTinggiBulan(87.1161, 'lk')
    expect(usia).toBeCloseTo(24, 1)
  })

  it('mengembalikan null bila tinggi di luar rentang median tabel', () => {
    expect(usiaTinggiBulan(40, 'lk')).toBeNull() // lebih pendek dari median lahir
    expect(usiaTinggiBulan(130, 'lk')).toBeNull() // lebih tinggi dari median 60 bulan
  })
})

describe('kebutuhan gizi: dua angka berdampingan', () => {
  it('kasus contoh telaah: anak laki-laki 24 bulan, tinggi 78 cm, berat 8 kg', () => {
    const hasil = hitungSkrining(input({ beratKg: 8, panjangCm: 78 }))

    expect(hasil.umurBulan).toBeGreaterThanOrEqual(24)
    expect(hasil.standarPanjang).toBe('berdiri')

    // Berat ideal untuk tinggi 78 cm menurut median BB/TB.
    expect(hasil.gizi.beratIdealKg).toBeCloseTo(10.21, 2)

    // Pemeliharaan: RDA(24 bulan) 100 kkal/kg x berat aktual 8 kg = 800 kkal.
    expect(hasil.gizi.rdaPemeliharaanKkalPerKg).toBe(100)
    expect(hasil.gizi.kaloriPemeliharaanKkal).toBe(800)

    // Tumbuh kejar: RDA(usia-tinggi) x berat ideal, sekitar 1.021 kkal.
    expect(hasil.gizi.kaloriCatchUpKkal).not.toBeNull()
    expect(hasil.gizi.kaloriCatchUpKkal as number).toBeGreaterThan(1000)
    expect(hasil.gizi.kaloriCatchUpKkal as number).toBeLessThan(1060)

    // Selisih sekitar 28 persen, sesuai perhitungan di dokumen telaah.
    const selisihPersen =
      ((hasil.gizi.kaloriCatchUpKkal as number) / hasil.gizi.kaloriPemeliharaanKkal - 1) * 100
    expect(selisihPersen).toBeGreaterThan(24)
    expect(selisihPersen).toBeLessThan(32)

    // Protein pemeliharaan memakai berat aktual, tumbuh kejar memakai berat ideal.
    expect(hasil.gizi.proteinPemeliharaanMinGram).toBeCloseTo(9.6, 1)
    expect(hasil.gizi.proteinPemeliharaanMaksGram).toBeCloseTo(12, 1)
    expect(hasil.gizi.proteinCatchUpMinGram as number).toBeCloseTo(15.3, 0)
    expect(hasil.gizi.proteinCatchUpMaksGram as number).toBeCloseTo(20.4, 0)

    // Anak berstatus gizi buruk, jadi target utama yang dianjurkan adalah tumbuh kejar.
    expect(hasil.statusBBTB).toBe('gizi_buruk')
    expect(hasil.gizi.metode).toBe('catch_up')
  })

  it('anak gizi baik dianjurkan memakai angka pemeliharaan', () => {
    const hasil = hitungSkrining(input({ beratKg: 12.2, panjangCm: 87.1 }))
    expect(hasil.statusBBTB).toBe('gizi_baik')
    expect(hasil.gizi.metode).toBe('pemeliharaan')
    // Angka tumbuh kejar tetap dihitung dan tersedia untuk dilihat dietisien.
    expect(hasil.gizi.kaloriCatchUpKkal).not.toBeNull()
  })

  it('anak gizi kurang juga dianjurkan memakai angka tumbuh kejar', () => {
    const hasil = hitungSkrining(input({ beratKg: 9.8, panjangCm: 87 }))
    expect(hasil.statusBBTB).toBe('gizi_kurang')
    expect(hasil.gizi.metode).toBe('catch_up')
  })

  it('angka tumbuh kejar bernilai null bila berat ideal tidak dapat dihitung', () => {
    const hasil = hitungSkrining(input({ panjangCm: 125, beratKg: 25 }))
    expect(hasil.gizi.beratIdealKg).toBeNull()
    expect(hasil.gizi.kaloriCatchUpKkal).toBeNull()
    expect(hasil.gizi.metode).toBe('pemeliharaan')
    // Kebutuhan pemeliharaan tetap dapat dihitung.
    expect(hasil.gizi.kaloriPemeliharaanKkal).toBeGreaterThan(0)
  })
})

describe('kasus lintas umur dan jenis kelamin', () => {
  const umurUji = [0, 6, 11, 23, 24, 25, 36, 59, 60]

  it.each(umurUji)('umur %i bulan menghasilkan ketiga indikator untuk kedua jenis kelamin', (bulan) => {
    for (const seks of ['lk', 'pr'] as const) {
      const hari = Math.round(bulan * 30.4375)
      const lahir = new Date(Date.UTC(2020, 0, 1))
      const periksa = new Date(lahir.getTime() + hari * 86_400_000)
      const iso = (d: Date) => d.toISOString().slice(0, 10)

      // Memakai median tabel agar seluruh indikator berada di tengah rentang.
      const hasil = hitungSkrining({
        tanggalLahir: iso(lahir),
        tanggalPeriksa: iso(periksa),
        jenisKelamin: seks,
        beratKg: bulan === 0 ? 3.3 : Math.min(2.5 + bulan * 0.26, 20),
        panjangCm: Math.min(49 + bulan * 1, 110),
        posisiUkur: 'otomatis',
      })

      expect(hasil.diLuarRentang, `${seks} ${bulan} bulan`).toBe(false)
      expect(hasil.bbu.z, `BB/U ${seks} ${bulan} bulan`).not.toBeNull()
      expect(hasil.tbu.z, `TB/U ${seks} ${bulan} bulan`).not.toBeNull()
      expect(hasil.bbtb.z, `BB/TB ${seks} ${bulan} bulan`).not.toBeNull()
      expect(hasil.statusBBU).not.toBeNull()
      expect(hasil.statusTBU).not.toBeNull()
      expect(hasil.statusBBTB).not.toBeNull()
    }
  })
})

describe('sifat murni fungsi', () => {
  it('masukan sama selalu menghasilkan keluaran sama', () => {
    const a = hitungSkrining(input())
    const b = hitungSkrining(input())
    expect(a).toEqual(b)
  })

  it('tidak mengubah objek masukan', () => {
    const masukan = input()
    const salinan = { ...masukan }
    hitungSkrining(masukan)
    expect(masukan).toEqual(salinan)
  })
})
