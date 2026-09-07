/**
 * Uji regresi untuk temuan audit September 2026.
 *
 * Setiap uji di berkas ini menguncikan satu perilaku yang SEBELUMNYA salah,
 * dan menyebut kode temuannya. Tujuannya bukan menaikkan cakupan, melainkan
 * memastikan cacat yang sama tidak kembali tanpa disadari.
 */
import { describe, expect, it } from 'vitest'
import {
  hitungSkrining, hitungVelocity, hitungUsiaKoreksi,
  BATAS as BATAS_SKRINING, BATAS_Z_WAJAR, ENGINE_VERSION,
} from '@/lib/zscore'
import { BATAS, hitungTakaran } from '@/lib/pkmk/hitung'
import { PRODUK_PKMK_LIST } from '@/lib/db/pkmk'
import { statusDariKenaikan, ambangP5Gram } from '@/lib/zscore/velocity'
import { nilaiDariLms, interpolasiLms } from '@/lib/zscore/lms'
import { tabelVelocity, tabelPanjang, tabelUmur } from '@/lib/who'
import { seriBBTB, titikGambarAnak, type KunjunganRiwayat } from '@/lib/grafik/seri'

const dasar = {
  tanggalLahir: '2024-01-01',
  tanggalPeriksa: '2026-01-01',
  jenisKelamin: 'lk' as const,
  beratKg: 12,
  panjangCm: 87,
  posisiUkur: 'otomatis' as const,
}

// =========================================================================
// Z-1  Berat yang turun tidak boleh pernah dilaporkan "naik"
// =========================================================================
describe('Z-1 status velocity untuk berat yang turun', () => {
  it('kenaikan nol atau negatif TIDAK PERNAH berstatus naik, berapa pun ambangnya', () => {
    // Ambang negatif adalah keadaan yang benar-benar terjadi pada tabel WHO.
    for (const ambang of [-200, -106, -1, 0, 1, 300]) {
      expect(statusDariKenaikan(0, ambang), `kenaikan 0, ambang ${ambang}`).not.toBe('naik')
      expect(statusDariKenaikan(-50, ambang), `kenaikan -50, ambang ${ambang}`).not.toBe('naik')
      expect(statusDariKenaikan(-1000, ambang), `kenaikan -1000, ambang ${ambang}`).not.toBe('naik')
    }
  })

  it('penurunan yang masih di atas ambang negatif diberi status tersendiri', () => {
    expect(statusDariKenaikan(-50, -88)).toBe('turun_masih_dalam_batas')
    expect(statusDariKenaikan(-300, -88)).toBe('tidak_naik')
    // Bila ambangnya positif, penurunan apa pun bukan "masih dalam batas".
    expect(statusDariKenaikan(-50, 200)).toBe('tidak_naik')
  })

  it('kenaikan positif tetap dinilai seperti semula', () => {
    expect(statusDariKenaikan(300, 200)).toBe('naik')
    expect(statusDariKenaikan(100, 200)).toBe('growth_faltering')
    expect(statusDariKenaikan(100, -88)).toBe('naik')
  })

  it('bayi 11 bulan yang turun 50 g dalam 30 hari tidak dilaporkan naik', () => {
    const h = hitungVelocity({
      tanggalLahir: '2025-01-01',
      jenisKelamin: 'lk',
      tanggalAwal: '2025-12-01',
      beratAwalKg: 9.5,
      tanggalAkhir: '2025-12-31',
      beratAkhirKg: 9.45,
    })
    expect(h.kenaikanAktualGram).toBe(-50)
    expect(h.kenaikanMinimalGram!).toBeLessThan(0)
    expect(h.ambangNegatif).toBe(true)
    expect(h.status).toBe('turun_masih_dalam_batas')
    expect(h.status).not.toBe('naik')
  })

  it('ambang negatif memang ada pada tabel WHO, jadi uji di atas bukan hipotetis', () => {
    const negatif: string[] = []
    for (const seks of ['lk', 'pr'] as const) {
      for (const iv of ['1bln', '2bln', '3bln'] as const) {
        const t = tabelVelocity(iv, seks)
        for (let b = t.bulanAwalMin; b <= t.bulanAwalMaks; b++) {
          const a = ambangP5Gram(t, b, t.hariStandar)
          if (a !== null && a < 0) negatif.push(`${seks}/${iv}/${b}`)
        }
      }
    }
    expect(negatif.length).toBeGreaterThan(20)
  })
})

// =========================================================================
// Z-2  Kurva tidak boleh menghilangkan kunjungan pada sumbu-x yang sama
// =========================================================================
describe('Z-2 titik kurva pada sumbu-x yang sama', () => {
  const riwayatTinggiSama: KunjunganRiwayat[] = [
    { tanggalPeriksa: '2026-01-10', umurBulan: 26, beratKg: 9.8, panjangTerkoreksiCm: 80, standarPanjang: 'berdiri', zBbu: -2.1, zTbu: -2.4, zBbtb: -1.9 },
    { tanggalPeriksa: '2026-03-10', umurBulan: 28, beratKg: 9.1, panjangTerkoreksiCm: 80, standarPanjang: 'berdiri', zBbu: -2.8, zTbu: -2.9, zBbtb: -2.6 },
    { tanggalPeriksa: '2026-05-10', umurBulan: 30, beratKg: 9.0, panjangTerkoreksiCm: 80, standarPanjang: 'berdiri', zBbu: -3.0, zTbu: -3.2, zBbtb: -2.8 },
  ]

  it('menggambar SETIAP kunjungan meski tinggi badannya tidak berubah', () => {
    const seri = seriBBTB(riwayatTinggiSama, 'lk')
    const digambar = titikGambarAnak(seri)
    expect(seri.anak).toHaveLength(3)
    expect(digambar).toHaveLength(3)
    // Ketiganya pada x yang sama, dengan berat yang berbeda.
    expect(digambar.map((t) => t.x)).toEqual([80, 80, 80])
    expect(digambar.map((t) => t.y)).toEqual([9.8, 9.1, 9.0])
    // Kunjungan terakhir, yang paling penting dilihat, ikut tergambar.
    expect(digambar.some((t) => t.tanggal === '2026-05-10')).toBe(true)
  })

  it('jumlah titik tergambar selalu sama dengan jumlah titik yang dapat dinilai', () => {
    const seri = seriBBTB(riwayatTinggiSama, 'lk')
    const dapatDinilai = seri.anak.filter((a) => !a.tidakDinilai).length
    expect(titikGambarAnak(seri)).toHaveLength(dapatDinilai)
  })
})

// =========================================================================
// Z-3  Penjagaan panjang badan dan penandaan Z tidak masuk akal
// =========================================================================
describe('Z-3 penjagaan panjang badan', () => {
  it('panjang di luar 30-140 cm ditolak, bukan dihitung', () => {
    for (const panjang of [8, 29.9, 140.1, 300]) {
      const h = hitungSkrining({ ...dasar, panjangCm: panjang })
      expect(h.alasanDiLuarRentang, `${panjang} cm`).toContain('panjang_di_luar_batas_wajar')
      expect(h.tbu.z, `${panjang} cm`).toBeNull()
    }
  })

  it('panjang 45 cm pada anak 24 bulan DITANDAI, tidak lagi disajikan sebagai sahih', () => {
    // Inilah kasus inti temuan: sebelumnya menghasilkan Z -13,785 dengan
    // diLuarRentang: false dan tanpa satu pun peringatan.
    const h = hitungSkrining({ ...dasar, panjangCm: 45 })
    expect(h.diLuarRentang).toBe(true)
    expect(h.alasanDiLuarRentang).toContain('panjang_tidak_wajar_untuk_umur')
    expect(h.catatanDiLuarRentang).toBeTruthy()
    expect(h.catatanDiLuarRentang).toMatch(/diukur ulang/i)
  })

  it('nilai ekstrem TETAP dikembalikan, karena membuangnya menghilangkan penanda rujukan', () => {
    // Anak 24 bulan, 87 cm, 8 kg adalah gizi buruk yang SEBENARNYA, dan
    // Z BB/TB-nya di luar batas penandaan WHO (-5). Bila nilai itu dibuang,
    // penanda rujukan ikut hilang dan anak paling berisiko tidak tertandai.
    const h = hitungSkrining({ ...dasar, beratKg: 8, panjangCm: 87 })
    expect(h.bbtb.z).not.toBeNull()
    expect(h.bbtb.z!).toBeLessThan(BATAS_Z_WAJAR.bbtb.min)
    expect(h.statusBBTB).toBe('gizi_buruk')
    expect(h.isRedFlag).toBe(true)
    expect(h.kodeRedFlag).toContain('bbtb_gizi_buruk')
    // Tetap ditandai supaya pengukuran diperiksa ulang.
    expect(h.alasanDiLuarRentang).toContain('berat_tidak_wajar_untuk_panjang')
  })

  it('anak dengan ukuran wajar tidak ikut tertandai', () => {
    const h = hitungSkrining(dasar)
    expect(h.diLuarRentang).toBe(false)
    expect(h.alasanDiLuarRentang).toHaveLength(0)
  })
})

// =========================================================================
// Z-4  Koreksi prematuritas: di dalam mesin, berbatas umur, dan terekam
// =========================================================================
describe('Z-4 koreksi prematuritas', () => {
  const bayi = {
    tanggalPeriksa: '2026-01-01',
    tanggalLahir: '2025-07-01',
    jenisKelamin: 'lk' as const,
    beratKg: 6,
    panjangCm: 62,
    posisiUkur: 'otomatis' as const,
  }

  it('dihitung di dalam mesin melalui usiaGestasiMinggu, bukan tanggal lahir palsu', () => {
    const tanpa = hitungSkrining(bayi)
    const dengan = hitungSkrining({ ...bayi, usiaGestasiMinggu: 32 })

    expect(tanpa.umurDikoreksiPrematur).toBe(false)
    expect(dengan.umurDikoreksiPrematur).toBe(true)
    expect(dengan.defisitPrematurHari).toBe(56)
    // Umur kronologis tetap tersimpan berdampingan, sehingga dapat diaudit.
    expect(dengan.umurKronologisHari).toBe(tanpa.umurHari)
    expect(dengan.umurHari).toBe(tanpa.umurHari - 56)
    // Dampaknya nyata: cukup untuk membalik status TB/U.
    expect(dengan.tbu.z!).toBeGreaterThan(tanpa.tbu.z!)
  })

  it('berhenti diterapkan setelah melewati batas umur koreksi', () => {
    const h = hitungSkrining({
      ...dasar,
      tanggalLahir: '2021-01-01',
      tanggalPeriksa: '2026-01-01',
      usiaGestasiMinggu: 28,
    })
    expect(h.umurDikoreksiPrematur).toBe(false)
    expect(h.defisitPrematurHari).toBe(0)
    expect(h.koreksiPrematurKedaluwarsa).toBe(true)
    expect(h.catatanDiLuarRentang).toMatch(/prematur/i)
  })

  it('usia gestasi di luar 22-42 minggu tidak pernah mengubah umur', () => {
    for (const g of [0, 4, 21, 43, 60, Number.NaN]) {
      const h = hitungUsiaKoreksi('2025-06-01', '2026-06-01', g)
      expect(h.isPrematur, `gestasi ${g}`).toBe(false)
      expect(h.defisitHari, `gestasi ${g}`).toBe(0)
    }
  })
})

// =========================================================================
// Z-9  Tidak ada lagi angka nol sebagai jawaban saat gagal
// =========================================================================
describe('Z-9 kegagalan dinyatakan null, bukan 0', () => {
  it('nilaiDariLms mengembalikan null bila basis Box-Cox tidak positif', () => {
    // L besar dan z sangat negatif membuat basis 1 + L*S*z menjadi <= 0.
    expect(nilaiDariLms([2, 10, 0.3], -10)).toBeNull()
    expect(nilaiDariLms([1, 0, 0.1], 0)).toBeNull()
    expect(nilaiDariLms([1, 10, 0], 0)).toBeNull()
  })

  it('nilai yang sah tetap dihitung seperti semula', () => {
    const lms = tabelPanjang('bbtb', 'lk')[85] as readonly [number, number, number]
    expect(nilaiDariLms(lms, 0)).toBeCloseTo(lms[1], 6)
  })
})

// =========================================================================
// Z-13  Celah tabel tidak boleh ditebak
// =========================================================================
describe('Z-13 celah di tengah tabel', () => {
  it('tepi atas tabel tetap sah', () => {
    const { lms, diLuarRentang } = interpolasiLms(60, tabelUmur('bbu', 'lk'), 1)
    expect(diLuarRentang).toBe(false)
    expect(lms).not.toBeNull()
  })

  it('celah di tengah tabel dinyatakan tidak dapat dinilai, bukan diisi baris lantai', () => {
    const bercelah = { 0: [1, 10, 0.1], 1: [1, 11, 0.1], 3: [1, 13, 0.1] } as never
    const hasil = interpolasiLms(1.5, bercelah, 1)
    expect(hasil.lms).toBeNull()
    expect(hasil.diLuarRentang).toBe(true)
  })
})

// =========================================================================
// Z-18  LILA: pita gizi kurang akut dan batas umur 59 bulan
// =========================================================================
describe('Z-18 penilaian LILA', () => {
  it('LILA di bawah 11,5 cm ditandai gizi buruk akut', () => {
    const h = hitungSkrining({ ...dasar, lilaCm: 11.0 })
    expect(h.kodeRedFlag).toContain('lila_gizi_buruk_akut')
  })

  it('LILA 11,5-12,4 cm ditandai gizi kurang akut sedang', () => {
    const h = hitungSkrining({ ...dasar, lilaCm: 12.0 })
    expect(h.kodeRedFlag).toContain('lila_gizi_kurang_akut')
    expect(h.kodeRedFlag).not.toContain('lila_gizi_buruk_akut')
  })

  it('LILA 12,5 cm dan ke atas tidak ditandai', () => {
    const h = hitungSkrining({ ...dasar, lilaCm: 12.5 })
    expect(h.kodeRedFlag.some((k) => k.startsWith('lila_'))).toBe(false)
  })

  it('LILA tidak dinilai di bawah 6 bulan maupun di atas 59 bulan', () => {
    const bayi = hitungSkrining({
      ...dasar,
      tanggalLahir: '2025-11-01',
      tanggalPeriksa: '2026-01-01',
      beratKg: 5,
      panjangCm: 57,
      lilaCm: 10,
    })
    expect(bayi.kodeRedFlag.some((k) => k.startsWith('lila_'))).toBe(false)

    const balitaBesar = hitungSkrining({
      ...dasar,
      tanggalLahir: '2021-01-05',
      tanggalPeriksa: '2026-01-01',
      beratKg: 16,
      panjangCm: 108,
      lilaCm: 10,
    })
    expect(balitaBesar.umurBulan).toBeGreaterThan(59)
    expect(balitaBesar.kodeRedFlag.some((k) => k.startsWith('lila_'))).toBe(false)
  })
})

// =========================================================================
// AGENTS.md 2.3  Penyaringan memakai kode, bukan pencocokan teks
// =========================================================================
describe('kodeRedFlag tersedia untuk penyaringan', () => {
  it('setiap alasan yang ditampilkan punya kode pendampingnya', () => {
    const h = hitungSkrining({ ...dasar, beratKg: 8, panjangCm: 75, edema: true, lilaCm: 11 })
    expect(h.isRedFlag).toBe(true)
    expect(h.kodeRedFlag.length).toBe(h.alasanRedFlag.length)
    expect(h.kodeRedFlag).toContain('edema_bilateral')
    expect(new Set(h.kodeRedFlag).size).toBe(h.kodeRedFlag.length)
  })

  it('anak tanpa temuan tidak memiliki kode rujukan', () => {
    const h = hitungSkrining(dasar)
    expect(h.isRedFlag).toBe(false)
    expect(h.kodeRedFlag).toHaveLength(0)
  })
})

// =========================================================================
// Batas 6 sendok takar per saji (keputusan pemilik aplikasi)
// =========================================================================
describe('batas sendok takar per saji', () => {
  it('batasnya 6, dan itu satu-satunya sumber angka tersebut', () => {
    expect(BATAS.sendokPerSajiMaks).toBe(6)
    expect(BATAS.sendokPerSajiMin).toBe(1)
  })

  it('mode dari_takaran menjepit masukan di atas 6', () => {
    const produk = PRODUK_PKMK_LIST.find((p) => p.nama === 'SGM Optigrow')!
    for (const diminta of [7, 10, 15, 99]) {
      const h = hitungTakaran({
        produk, mode: 'dari_takaran', frekuensiPerHari: 3, sendokPerSaji: diminta, targetKkal: 600,
      })
      expect(h.sendokPerSaji, `diminta ${diminta}`).toBe(6)
      // Energi tetap turunan takaran AKHIR, bukan takaran yang diminta.
      expect(h.kkalDiberikan).toBe(6 * 3 * produk.kkalPerSendok)
    }
  })

  it('mode dari_target menjepit ke 6 dan MENYATAKAN target tidak tercapai', () => {
    const produk = PRODUK_PKMK_LIST.find((p) => p.nama === 'SGM Gain 100')! // 20 kkal/sendok
    const h = hitungTakaran({ produk, mode: 'dari_target', frekuensiPerHari: 3, targetKkal: 900 })
    expect(h.sendokPerSaji).toBe(6)
    expect(h.kkalDiberikan).toBe(360) // 6 x 3 x 20
    expect(h.peringatan.map((p) => p.kode)).toContain('target_tidak_tercapai')
  })

  it('tidak pernah menghasilkan takaran di atas 6 pada kombinasi apa pun', () => {
    for (const produk of PRODUK_PKMK_LIST) {
      for (let target = 50; target <= 1500; target += 50) {
        for (let f = BATAS.frekuensiMin; f <= BATAS.frekuensiMaks; f++) {
          const h = hitungTakaran({ produk, mode: 'dari_target', frekuensiPerHari: f, targetKkal: target })
          expect(h.sendokPerSaji, `${produk.nama} ${target} kkal ${f}x`).toBeLessThanOrEqual(6)
          expect(h.sendokPerSaji).toBeGreaterThanOrEqual(1)
        }
      }
    }
  })
})

// =========================================================================
// Versi engine tidak ditulis tangan di lapisan tampilan
// =========================================================================
describe('versi engine', () => {
  it('ENGINE_VERSION adalah satu-satunya sumber nomor versi', () => {
    expect(ENGINE_VERSION).toBe('zscore-2.1.0')
  })
})

// =========================================================================
// Catatan memakai pemisah desimal Indonesia
// =========================================================================
describe('pemisah desimal pada catatan', () => {
  it('catatan di luar rentang memakai koma, bukan titik', () => {
    const h = hitungSkrining({ ...dasar, panjangCm: 45 })
    expect(h.catatanDiLuarRentang).toBeTruthy()
    // Tidak boleh ada pola angka bertitik desimal, mis. "-13.789" atau "24.0".
    expect(h.catatanDiLuarRentang!).not.toMatch(/-?\d+\.\d/)
    expect(h.catatanDiLuarRentang!).toMatch(/-?\d+,\d/)
  })
})

// =========================================================================
// Z-12  Cakupan tabel KBM selaras dengan batas mesin
// =========================================================================
describe('Z-12 batas velocity', () => {
  it('jarak timbang di luar 21-110 hari tidak dinilai', () => {
    const rapat = hitungVelocity({
      tanggalLahir: '2025-01-01', jenisKelamin: 'lk',
      tanggalAwal: '2025-06-01', beratAwalKg: 7,
      tanggalAkhir: '2025-06-10', beratAkhirKg: 7.2,
    })
    expect(rapat.status).toBe('tidak_dapat_dinilai')
    expect(rapat.alasan).toBe('jarak_terlalu_rapat')
    expect(rapat.metode).toBe('tidak_ada')
  })

  it('BATAS mesin skrining dan ambang Z terekspos untuk dipakai lapisan lain', () => {
    expect(BATAS_SKRINING.panjangMinCm).toBe(30)
    expect(BATAS_SKRINING.panjangMaksCm).toBe(140)
    expect(BATAS_Z_WAJAR.tbu).toEqual({ min: -6, maks: 6 })
  })
})
