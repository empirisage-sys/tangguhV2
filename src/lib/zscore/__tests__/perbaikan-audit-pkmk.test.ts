/**
 * Uji pengunci temuan audit PKMK (P-1 sampai P-5).
 *
 * Keempat temuan lolos dari 78 uji PKMK yang sudah ada karena semuanya menguji
 * aritmetika `hitungTakaran`, yang memang benar. Cacatnya berada di TEPI mesin:
 * angka kebutuhan yang masuk, penyaring umur, rujukan skrining, keadaan target
 * nol, dan penempatan jam pada jadwal.
 */
import { describe, expect, it } from 'vitest'
import { hitungTakaran } from '@/lib/pkmk/hitung'
import { produkSesuaiUmur, PRODUK_PKMK, produkUntukUmur } from '@/lib/pkmk/produk'
import { bacaSeluruhPeringatan } from '@/lib/pkmk/teks'
import {
  susunJadwal,
  banyakSlotPkmk,
  banyakMakanUtama,
  sebarPkmkTanpaMenghapusMakan,
  JAM_JADWAL,
} from '@/lib/pkmk/jadwal'
import type { ProdukPKMK } from '@/lib/pkmk/produk'

const produkUji: ProdukPKMK = {
  ...(PRODUK_PKMK[0] as ProdukPKMK),
  id: 'uji-1',
  nama: 'Produk Uji',
  minUsiaBulan: 12,
  maksUsiaBulan: 24,
}

describe('P-2 batas umur produk akhirnya ditegakkan', () => {
  it('produk berindikasi 12-24 bulan ditolak untuk balita 59 bulan', () => {
    expect(produkSesuaiUmur(produkUji, 59)).toBe(false)
    expect(produkSesuaiUmur(produkUji, 24)).toBe(true)
    expect(produkSesuaiUmur(produkUji, 24.1)).toBe(false)
  })

  it('batas bawah tetap berlaku', () => {
    expect(produkSesuaiUmur(produkUji, 11.9)).toBe(false)
    expect(produkSesuaiUmur(produkUji, 12)).toBe(true)
  })

  it('tanpa batas atas, hanya batas bawah yang berlaku', () => {
    const tanpaBatas: ProdukPKMK = { ...produkUji, maksUsiaBulan: null }
    expect(produkSesuaiUmur(tanpaBatas, 59)).toBe(true)
  })

  it('umur bukan angka ditolak, bukan diloloskan', () => {
    expect(produkSesuaiUmur(produkUji, Number.NaN)).toBe(false)
  })

  it('balita 6 bulan tidak mendapat satu pun produk seed, dan daftarnya TETAP kosong', () => {
    // Bentuk lama pada lapisan komponen mengembalikan SELURUH daftar begitu
    // tidak ada yang cocok, sehingga kelima produk 12 bulan ke atas tetap
    // ditawarkan untuk bayi 6 bulan tanpa penanda apa pun.
    expect(produkUntukUmur(6)).toHaveLength(0)
    expect(produkUntukUmur(24).length).toBeGreaterThan(0)
  })
})

describe('P-4 target nol tidak lagi membungkam peringatan', () => {
  const produk = PRODUK_PKMK[0] as ProdukPKMK

  it('takaran besar dengan target 0 kkal tetap berperingatan', () => {
    const hasil = hitungTakaran({
      produk,
      mode: 'dari_takaran',
      frekuensiPerHari: 6,
      sendokPerSaji: 6,
      targetKkal: 0,
    })

    // Dahulu tepat kosong: tidak ada satu pun tanda bahwa 36 sendok sehari
    // tidak dinilai terhadap apa pun.
    expect(hasil.peringatan.length).toBeGreaterThan(0)
    expect(hasil.peringatan.map((p) => p.kode)).toContain('target_belum_ditetapkan')
    const nada = hasil.peringatan.find((p) => p.kode === 'target_belum_ditetapkan')?.nada
    expect(nada).toBe('bahaya')
  })

  it('peringatannya punya kalimat yang dapat dibaca', () => {
    const hasil = hitungTakaran({
      produk,
      mode: 'dari_takaran',
      frekuensiPerHari: 3,
      sendokPerSaji: 3,
      targetKkal: 0,
    })
    const terbaca = bacaSeluruhPeringatan(hasil)
    const p = terbaca.find((x) => x.kode === 'target_belum_ditetapkan')
    expect(p?.pesan).toContain('belum ditetapkan')
    expect(p?.saran.length).toBeGreaterThan(10)
  })

  it('target wajar tidak memunculkan peringatan itu', () => {
    const hasil = hitungTakaran({
      produk,
      mode: 'dari_target',
      frekuensiPerHari: 3,
      targetKkal: 600,
    })
    expect(hasil.peringatan.map((p) => p.kode)).not.toContain('target_belum_ditetapkan')
  })
})

describe('P-5 jadwal tidak lagi menghapus seluruh waktu makan utama', () => {
  const produk = PRODUK_PKMK[0] as ProdukPKMK

  const jadwalUntuk = (frekuensi: number) =>
    susunJadwal({
      hasil: hitungTakaran({
        produk,
        mode: 'dari_takaran',
        frekuensiPerHari: frekuensi,
        sendokPerSaji: 3,
        targetKkal: 800,
      }),
      masihASI: false,
    })

  it('pada 6x sehari masih ada waktu makan utama', () => {
    const jadwal = jadwalUntuk(6)
    // Inti temuan P-5: dahulu nol.
    expect(banyakMakanUtama(jadwal)).toBeGreaterThan(0)
  })

  it('aturan yang mengikat tetap dipenuhi pada setiap frekuensi', () => {
    for (let f = 1; f <= 6; f += 1) {
      const jadwal = jadwalUntuk(f)
      expect(banyakSlotPkmk(jadwal)).toBe(f)
    }
  })

  it('sampai 5x sehari, ketiga waktu makan utama utuh', () => {
    for (let f = 1; f <= 5; f += 1) {
      expect(banyakMakanUtama(jadwalUntuk(f))).toBe(3)
    }
  })

  it('bila makan utama harus dipakai, makan malam yang lebih dahulu diambil', () => {
    // Kisi 8 jam, makan utama pada indeks 1 (08.00), 3 (12.00), 6 (18.00).
    const enam = sebarPkmkTanpaMenghapusMakan(6, JAM_JADWAL.length)
    expect(enam).toHaveLength(6)
    expect(enam).toContain(6) // 18.00 terpakai
    expect(enam).not.toContain(1) // 08.00 bertahan
    expect(enam).not.toContain(3) // 12.00 bertahan
  })

  it('jam PKMK tidak pernah ganda', () => {
    for (let f = 1; f <= 6; f += 1) {
      const indeks = sebarPkmkTanpaMenghapusMakan(f, JAM_JADWAL.length)
      expect(new Set(indeks).size).toBe(indeks.length)
    }
  })
})
