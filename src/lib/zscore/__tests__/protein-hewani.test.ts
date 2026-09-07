import { describe, it, expect } from 'vitest'
import {
  PANDUAN_PROTEIN,
  proteinUntukUmur,
  SUMBER_PANDUAN_PROTEIN,
  SUMBER_PANDUAN_PROTEIN_RINGKAS,
} from '@/lib/pkmk/protein'
import { produkById } from '@/lib/pkmk/produk'
import { hitungTakaran } from '@/lib/pkmk/hitung'
import { susunJadwal } from '@/lib/pkmk/jadwal'
import { bacaSlotJadwal } from '@/lib/pkmk/teks'
import { buatPdfLembarAsuhanGizi } from '@/lib/ekspor/pdf-asuhan-gizi'

const optigrow = produkById('pkmk-2')!

describe('panduan protein hewani (Sjarif DR, 2022)', () => {
  it('memuat tiga kelompok umur', () => {
    expect(PANDUAN_PROTEIN).toHaveLength(3)
  })

  it('angka kecukupan protein sesuai tabel sumber', () => {
    expect(PANDUAN_PROTEIN.map((k) => k.akgProteinGram)).toEqual([15, 20, 25])
  })

  it('setiap kelompok menyediakan tepat tiga variasi', () => {
    for (const k of PANDUAN_PROTEIN) {
      expect(k.variasi).toHaveLength(3)
      for (const v of k.variasi) expect(v.length).toBeGreaterThan(3)
    }
  })

  it('isi kelompok 13-24 bulan sesuai tabel sumber', () => {
    const k = proteinUntukUmur(19)!
    expect(k.akgProteinGram).toBe(20)
    expect(k.sumberTambahanPosyandu).toBe('1 telur + 1 susu UHT')
    expect(k.variasi[0]).toBe('1 hati ayam')
    expect(k.variasi[1]).toBe('1 telur + 1 sdm daging sapi/ikan/ayam')
    expect(k.variasi[2]).toBe('1 telur + 1 susu UHT')
  })

  it('isi kelompok 24-60 bulan sesuai tabel sumber', () => {
    const k = proteinUntukUmur(30)!
    expect(k.akgProteinGram).toBe(25)
    expect(k.sumberTambahanPosyandu).toBe('3 susu UHT')
    expect(k.variasi[2]).toBe('2 telur')
  })

  it('umur 12 bulan tetap terlayani meski tabel sumber mulai dari 13', () => {
    const k = proteinUntukUmur(12)
    expect(k).not.toBeNull()
    expect(k!.akgProteinGram).toBe(20)
    // Label yang dicetak tetap rentang asli dari sumber.
    expect(k!.labelUmur).toBe('13 – 24 bulan')
  })

  it('umur 24 bulan masuk kelompok 24-60, bukan kelompok sebelumnya', () => {
    expect(proteinUntukUmur(24)!.akgProteinGram).toBe(25)
    expect(proteinUntukUmur(23)!.akgProteinGram).toBe(20)
  })

  it('batas atas dan bawah seluruh tabel', () => {
    expect(proteinUntukUmur(6)!.akgProteinGram).toBe(15)
    expect(proteinUntukUmur(60)!.akgProteinGram).toBe(25)
  })

  it('umur di luar tabel tidak dijepit ke kelompok terdekat', () => {
    expect(proteinUntukUmur(3)).toBeNull()
    expect(proteinUntukUmur(72)).toBeNull()
    expect(proteinUntukUmur(Number.NaN)).toBeNull()
  })

  it('setiap umur 6 sampai 60 bulan mendapat tepat satu kelompok', () => {
    for (let u = 6; u <= 60; u++) {
      const cocok = PANDUAN_PROTEIN.filter(
        (k) => u >= k.umurMinBulan && u <= k.umurMaksBulan,
      )
      expect(cocok).toHaveLength(1)
    }
  })

  it('menyebut sumbernya', () => {
    expect(SUMBER_PANDUAN_PROTEIN).toContain('Sjarif DR, 2022')
    expect(SUMBER_PANDUAN_PROTEIN_RINGKAS).toContain('Sjarif DR')
  })
})

describe('menu protein pada jadwal', () => {
  const hasil = hitungTakaran({
    produk: optigrow, mode: 'dari_takaran', frekuensiPerHari: 3, sendokPerSaji: 3, targetKkal: 600,
  })
  const jadwal = susunJadwal({ hasil, masihASI: false })

  it('baris selingan menyebut sumber tambahan posyandu sesuai umur', () => {
    const bayi = bacaSlotJadwal(jadwal.slot[2]!, optigrow.nama, proteinUntukUmur(19))
    expect(bayi.biasa).toContain('1 telur + 1 susu UHT')
    const balita = bacaSlotJadwal(jadwal.slot[2]!, optigrow.nama, proteinUntukUmur(30))
    expect(balita.biasa).toContain('3 susu UHT')
  })

  it('baris makan utama mengarahkan ke tabel variasi', () => {
    const teks = bacaSlotJadwal(jadwal.slot[1]!, optigrow.nama, proteinUntukUmur(19))
    expect(teks.biasa).toContain('variasi')
    expect(teks.biasa).not.toContain('min 6 gr')
  })

  it('tanpa data umur, kalimatnya tetap masuk akal', () => {
    const teks = bacaSlotJadwal(jadwal.slot[1]!, optigrow.nama, null)
    expect(teks.biasa).toContain('protein hewani')
  })
})

describe('tabel protein pada lembar PDF', () => {
  const dasar = {
    namaBalita: 'Putra',
    tataLaksana: 'PKMK + observasi 2 minggu',
    totalKebutuhanKkal: 750,
  }
  const hasil = hitungTakaran({
    produk: optigrow, mode: 'dari_takaran', frekuensiPerHari: 3, sendokPerSaji: 3, targetKkal: 600,
  })

  it('mencetak ketiga variasi untuk umur balita', async () => {
    const berkas = await buatPdfLembarAsuhanGizi({ ...dasar, umurBulan: 19 }, hasil)
    const isi = new TextDecoder('latin1').decode(berkas)
    expect(isi).toContain('Kecukupan Protein Hewani Harian')
    expect(isi).toContain('Variasi 1')
    expect(isi).toContain('Variasi 3')
    expect(isi).toContain('1 hati ayam')
    expect(isi).toContain('20 g/hari')
    expect(isi).toContain('Sjarif DR')
  })

  it('mencetak menu kelompok umur yang berbeda untuk balita lebih besar', async () => {
    const isi = new TextDecoder('latin1').decode(
      await buatPdfLembarAsuhanGizi({ ...dasar, umurBulan: 30 }, hasil),
    )
    expect(isi).toContain('25 g/hari')
    expect(isi).toContain('3 susu UHT')
    expect(isi).not.toContain('20 g/hari')
  })

  it('tidak mencetak tabel protein bila umur di luar tabel', async () => {
    const isi = new TextDecoder('latin1').decode(
      await buatPdfLembarAsuhanGizi({ ...dasar, umurBulan: 3 }, hasil),
    )
    expect(isi).not.toContain('Kecukupan Protein Hewani Harian')
  })

  it('lembar tetap satu halaman untuk seluruh kelompok umur', async () => {
    for (const umur of [6, 11, 12, 19, 24, 40, 60]) {
      const isi = new TextDecoder('latin1').decode(
        await buatPdfLembarAsuhanGizi({ ...dasar, umurBulan: umur }, hasil),
      )
      expect(isi).not.toContain('Halaman 2 dari')
    }
  })
})
