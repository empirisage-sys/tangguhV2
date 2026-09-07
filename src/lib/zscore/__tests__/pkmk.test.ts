import { describe, it, expect } from 'vitest'
import {
  PRODUK_PKMK,
  produkUntukUmur,
  produkById,
  PERINGATAN_DATA_PRODUK,
} from '@/lib/pkmk/produk'
import {
  BATAS,
  hitungTakaran,
  pilihanTakaran,
  sisaDariMakanan,
} from '@/lib/pkmk/hitung'
import { ringkasanTakaran, bacaSeluruhPeringatan } from '@/lib/pkmk/teks'

const optigrow = produkById('pkmk-2')!
const gain100 = produkById('pkmk-1')!
const nutrinidrink = produkById('pkmk-5')!

describe('produk.ts — angka turunan, bukan angka patokan', () => {
  it('menyediakan lima produk', () => {
    expect(PRODUK_PKMK).toHaveLength(5)
  })

  it('kkal per sendok dihitung dari kkal per saji dibagi sendok per saji', () => {
    for (const p of PRODUK_PKMK) {
      expect(p.kkalPerSendok).toBe(p.kkalPerSaji / p.sendokPerSaji)
    }
  })

  it('ml larutan per sendok dihitung dari ml per saji dibagi sendok per saji', () => {
    for (const p of PRODUK_PKMK) {
      expect(p.mlLarutanPerSendok).toBe(p.mlLarutanPerSaji / p.sendokPerSaji)
    }
  })

  it('tidak ada satu pun produk yang bernilai 25 kkal per sendok (cacat lama)', () => {
    expect(PRODUK_PKMK.some((p) => p.kkalPerSendok === 25)).toBe(false)
  })

  it('tidak seluruh produk bernilai 30 ml per sendok (cacat lama)', () => {
    const semuaTigaPuluh = PRODUK_PKMK.every((p) => p.mlLarutanPerSendok === 30)
    expect(semuaTigaPuluh).toBe(false)
  })

  it('nilai turunan sesuai tabel telaah', () => {
    expect(gain100.kkalPerSendok).toBe(20)
    expect(gain100.mlLarutanPerSendok).toBe(18)
    expect(optigrow.kkalPerSendok).toBe(40)
    expect(optigrow.mlLarutanPerSendok).toBe(45)
    expect(nutrinidrink.kkalPerSendok).toBe(30)
    expect(nutrinidrink.mlLarutanPerSendok).toBe(15)
  })

  it('id produk unik', () => {
    const id = new Set(PRODUK_PKMK.map((p) => p.id))
    expect(id.size).toBe(PRODUK_PKMK.length)
  })

  it('produkUntukUmur menyaring sesuai umur minimum', () => {
    expect(produkUntukUmur(6)).toHaveLength(0)
    expect(produkUntukUmur(24).length).toBeGreaterThan(0)
  })

  it('produkUntukUmur menolak umur bukan angka', () => {
    expect(produkUntukUmur(Number.NaN)).toHaveLength(0)
  })

  it('produkById mengembalikan null untuk id tak dikenal', () => {
    expect(produkById('tidak-ada')).toBeNull()
  })

  it('peringatan data produk tersedia untuk dicetak di setiap layar', () => {
    expect(PERINGATAN_DATA_PRODUK).toMatch(/belum diverifikasi/i)
  })
})

describe('hitungTakaran — mode dari_takaran', () => {
  it('energi dihitung dari takaran, bukan dari target', () => {
    const hasil = hitungTakaran({
      produk: optigrow,
      mode: 'dari_takaran',
      frekuensiPerHari: 3,
      sendokPerSaji: 3,
      targetKkal: 600,
    })
    expect(hasil.kkalDiberikan).toBe(360)
    expect(hasil.targetKkal).toBe(600)
    expect(hasil.selisihKkal).toBe(-240)
  })

  it('mengubah sendok per saji mengubah energi yang diberikan', () => {
    const dasar = { produk: optigrow, mode: 'dari_takaran' as const, frekuensiPerHari: 3, targetKkal: 600 }
    const tiga = hitungTakaran({ ...dasar, sendokPerSaji: 3 })
    const lima = hitungTakaran({ ...dasar, sendokPerSaji: 5 })
    expect(tiga.kkalDiberikan).toBe(360)
    expect(lima.kkalDiberikan).toBe(600)
    expect(lima.kkalDiberikan).not.toBe(tiga.kkalDiberikan)
  })

  it('mengubah frekuensi mengubah energi yang diberikan', () => {
    const dasar = { produk: optigrow, mode: 'dari_takaran' as const, sendokPerSaji: 3, targetKkal: 600 }
    expect(hitungTakaran({ ...dasar, frekuensiPerHari: 2 }).kkalDiberikan).toBe(240)
    expect(hitungTakaran({ ...dasar, frekuensiPerHari: 4 }).kkalDiberikan).toBe(480)
  })

  it('mengganti produk mengubah volume larutan per saji', () => {
    const dasar = { mode: 'dari_takaran' as const, frekuensiPerHari: 3, sendokPerSaji: 3, targetKkal: 600 }
    expect(hitungTakaran({ ...dasar, produk: optigrow }).mlLarutanPerSaji).toBe(135)
    expect(hitungTakaran({ ...dasar, produk: gain100 }).mlLarutanPerSaji).toBe(54)
    expect(hitungTakaran({ ...dasar, produk: nutrinidrink }).mlLarutanPerSaji).toBe(45)
  })

  it('volume tidak pernah memakai angka tetap 30 ml per sendok', () => {
    const hasil = hitungTakaran({
      produk: optigrow, mode: 'dari_takaran', frekuensiPerHari: 3, sendokPerSaji: 3, targetKkal: 600,
    })
    expect(hasil.mlLarutanPerSaji).not.toBe(90)
  })

  it('menjepit sendok per saji pada batas atas', () => {
    const hasil = hitungTakaran({
      produk: optigrow, mode: 'dari_takaran', frekuensiPerHari: 3, sendokPerSaji: 99, targetKkal: 600,
    })
    expect(hasil.sendokPerSaji).toBe(BATAS.sendokPerSajiMaks)
  })

  it('menjepit frekuensi pada batas bawah', () => {
    const hasil = hitungTakaran({
      produk: optigrow, mode: 'dari_takaran', frekuensiPerHari: 0, sendokPerSaji: 3, targetKkal: 600,
    })
    expect(hasil.frekuensiPerHari).toBe(BATAS.frekuensiMin)
  })

  it('persen terhadap target memakai energi nyata', () => {
    const hasil = hitungTakaran({
      produk: optigrow, mode: 'dari_takaran', frekuensiPerHari: 3, sendokPerSaji: 3, targetKkal: 600,
    })
    expect(hasil.persenTerhadapTarget).toBe(60)
  })
})

describe('hitungTakaran — mode dari_target dan pembulatan sendok', () => {
  it('pembulatan sendok tidak disembunyikan: 675 kkal 3x menjadi 6 sendok dan 720 kkal', () => {
    const hasil = hitungTakaran({
      produk: optigrow, mode: 'dari_target', frekuensiPerHari: 3, targetKkal: 675,
    })
    expect(hasil.sendokPerSaji).toBe(6)
    expect(hasil.kkalDiberikan).toBe(720)
    expect(hasil.kkalDiberikan).not.toBe(675)
    expect(hasil.persenTerhadapTarget).toBe(106.7)
  })

  it('sesuai tabel telaah untuk frekuensi 2x dan 4x', () => {
    const dua = hitungTakaran({ produk: optigrow, mode: 'dari_target', frekuensiPerHari: 2, targetKkal: 675 })
    expect([dua.sendokPerSaji, dua.kkalDiberikan, dua.mlLarutanPerSaji]).toEqual([8, 640, 360])
    const empat = hitungTakaran({ produk: optigrow, mode: 'dari_target', frekuensiPerHari: 4, targetKkal: 675 })
    expect([empat.sendokPerSaji, empat.kkalDiberikan, empat.mlLarutanPerSaji]).toEqual([4, 640, 180])
  })

  it('sendok tidak pernah kurang dari satu meski target nol', () => {
    const hasil = hitungTakaran({ produk: optigrow, mode: 'dari_target', frekuensiPerHari: 3, targetKkal: 0 })
    expect(hasil.sendokPerSaji).toBe(1)
  })
})

describe('peringatan otomatis', () => {
  it('memunculkan peringatan kurang dari target', () => {
    const hasil = hitungTakaran({
      produk: optigrow, mode: 'dari_takaran', frekuensiPerHari: 3, sendokPerSaji: 3, targetKkal: 600,
    })
    const kode = hasil.peringatan.map((p) => p.kode)
    expect(kode).toContain('kurang_dari_target')
    expect(hasil.peringatan.find((p) => p.kode === 'kurang_dari_target')!.nada).toBe('bahaya')
  })

  it('memunculkan peringatan lebih dari target', () => {
    const hasil = hitungTakaran({
      produk: optigrow, mode: 'dari_takaran', frekuensiPerHari: 3, sendokPerSaji: 8, targetKkal: 600,
    })
    expect(hasil.peringatan.map((p) => p.kode)).toContain('lebih_dari_target')
  })

  it('tidak memunculkan peringatan energi bila selisih dalam toleransi', () => {
    const hasil = hitungTakaran({
      produk: optigrow, mode: 'dari_target', frekuensiPerHari: 4, targetKkal: 675,
    })
    const kode = hasil.peringatan.map((p) => p.kode)
    expect(kode).not.toContain('kurang_dari_target')
    expect(kode).not.toContain('lebih_dari_target')
  })

  it('memunculkan peringatan volume per saji berlebih', () => {
    const hasil = hitungTakaran({
      produk: optigrow, mode: 'dari_target', frekuensiPerHari: 2, targetKkal: 675,
    })
    expect(hasil.mlLarutanPerSaji).toBeGreaterThan(BATAS.mlPerSajiWajarMaks)
    expect(hasil.peringatan.map((p) => p.kode)).toContain('volume_per_saji_berlebih')
  })

  it('memunculkan peringatan target tidak tercapai pada batas sendok', () => {
    const hasil = hitungTakaran({
      produk: gain100, mode: 'dari_target', frekuensiPerHari: 1, targetKkal: 900,
    })
    expect(hasil.sendokPerSaji).toBe(BATAS.sendokPerSajiMaks)
    expect(hasil.peringatan.map((p) => p.kode)).toContain('target_tidak_tercapai')
  })

  it('setiap peringatan dapat dibaca menjadi pesan dan saran', () => {
    const hasil = hitungTakaran({
      produk: optigrow, mode: 'dari_takaran', frekuensiPerHari: 3, sendokPerSaji: 3, targetKkal: 600,
    })
    const terbaca = bacaSeluruhPeringatan(hasil)
    expect(terbaca).toHaveLength(hasil.peringatan.length)
    for (const p of terbaca) {
      expect(p.pesan.length).toBeGreaterThan(10)
      expect(p.saran.length).toBeGreaterThan(10)
      expect(['waspada', 'bahaya']).toContain(p.nada)
    }
  })
})

describe('pilihanTakaran dan sisaDariMakanan', () => {
  it('menyusun satu pilihan untuk setiap frekuensi yang diizinkan', () => {
    const daftar = pilihanTakaran(optigrow, 675)
    expect(daftar).toHaveLength(BATAS.frekuensiMaks - BATAS.frekuensiMin + 1)
  })

  it('mendahulukan pilihan yang volume per sajinya wajar', () => {
    const daftar = pilihanTakaran(optigrow, 675)
    expect(daftar[0]!.volumeWajar).toBe(true)
    expect(daftar[0]!.frekuensiPerHari).toBe(4)
    const indeksTidakWajar = daftar.findIndex((p) => !p.volumeWajar)
    const indeksWajarTerakhir = daftar.map((p) => p.volumeWajar).lastIndexOf(true)
    expect(indeksWajarTerakhir).toBeLessThan(indeksTidakWajar)
  })

  it('sisa dari makanan keluarga dihitung dari energi nyata, bukan dari target', () => {
    const hasil = hitungTakaran({
      produk: optigrow, mode: 'dari_takaran', frekuensiPerHari: 3, sendokPerSaji: 3, targetKkal: 600,
    })
    expect(sisaDariMakanan(750, hasil)).toBe(390)
    expect(sisaDariMakanan(750, hasil)).not.toBe(150)
  })

  it('sisa tidak pernah negatif', () => {
    const hasil = hitungTakaran({
      produk: optigrow, mode: 'dari_takaran', frekuensiPerHari: 5, sendokPerSaji: 10, targetKkal: 600,
    })
    expect(sisaDariMakanan(750, hasil)).toBe(0)
  })

  it('ringkasan memuat takaran nyata beserta energinya', () => {
    const hasil = hitungTakaran({
      produk: optigrow, mode: 'dari_takaran', frekuensiPerHari: 3, sendokPerSaji: 3, targetKkal: 600,
    })
    const teks = ringkasanTakaran(hasil)
    expect(teks).toContain('3x sehari')
    expect(teks).toContain('135 ml')
    expect(teks).toContain('360 kkal')
    expect(teks).not.toContain('600 kkal')
  })
})

describe('regresi — cacat lama tidak boleh kembali', () => {
  it('kasus tangkapan layar: Optigrow 3x 3 sendok target 600 memberi 360 kkal, bukan 600', () => {
    const hasil = hitungTakaran({
      produk: optigrow, mode: 'dari_takaran', frekuensiPerHari: 3, sendokPerSaji: 3, targetKkal: 600,
    })
    expect(hasil.kkalDiberikan).toBe(360)
    expect(hasil.mlLarutanPerSaji).toBe(135)
    expect(hasil.peringatan.map((p) => p.kode)).toContain('kurang_dari_target')
    expect(sisaDariMakanan(750, hasil)).toBe(390)
  })

  it('energi yang dilaporkan SELALU sama dengan sendok per hari dikali kkal per sendok', () => {
    for (const produk of PRODUK_PKMK) {
      for (let f = BATAS.frekuensiMin; f <= BATAS.frekuensiMaks; f++) {
        for (let s = BATAS.sendokPerSajiMin; s <= BATAS.sendokPerSajiMaks; s++) {
          const hasil = hitungTakaran({
            produk, mode: 'dari_takaran', frekuensiPerHari: f, sendokPerSaji: s, targetKkal: 700,
          })
          expect(hasil.sendokPerHari).toBe(s * f)
          expect(hasil.kkalDiberikan).toBe(hasil.sendokPerHari * produk.kkalPerSendok)
        }
      }
    }
  })

  it('mode dari_target pun tidak pernah melaporkan target sebagai kenyataan', () => {
    for (const produk of PRODUK_PKMK) {
      for (let f = BATAS.frekuensiMin; f <= BATAS.frekuensiMaks; f++) {
        const hasil = hitungTakaran({ produk, mode: 'dari_target', frekuensiPerHari: f, targetKkal: 675 })
        expect(hasil.kkalDiberikan).toBe(hasil.sendokPerHari * produk.kkalPerSendok)
      }
    }
  })
})
