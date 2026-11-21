import { describe, expect, it } from 'vitest'
import { petakanProdukDbKeModel } from '@/lib/db/pkmk'
import { hitungTakaran } from '@/lib/pkmk/hitung'
import { susunJadwal } from '@/lib/pkmk/jadwal'
import { namaSatuan, satuanSah } from '@/lib/pkmk/produk'
import {
  bacaSeluruhPeringatan,
  bacaSlotJadwal,
  keteranganProduk,
  ringkasanTakaran,
} from '@/lib/pkmk/teks'
import { skemaProdukPKMKAdmin } from '@/lib/validasi/pkmk'

/** Baris Transvita sebagaimana akan disimpan admin: 1 sachet 40 g + 135 ml air. */
const barisTransvita = {
  id: 'transvita',
  nama: 'Transvita',
  merek: 'PT Lukas Transamin Perkasa',
  sendok_per_saji: 1,
  satuan_takar: 'sachet',
  kkal_per_saji: 165,
  ml_per_saji: 165,
  ml_air_per_sendok: 135,
  gram_per_sendok_takar: 40,
  min_usia_bulan: 12,
  is_active: true,
}

const masukanAdminTransvita = {
  nama: 'Transvita',
  merek: 'PT Lukas Transamin Perkasa',
  kkalPerSaji: 165,
  sendokPerSaji: 1,
  satuanTakar: 'sachet',
  densitasKkalPerMl: 1,
  mlAirPerSendok: 135,
  mlPerSaji: 165,
  minUsiaBulan: 12,
  gramPerSendokTakar: 40,
}

describe('Satuan takar PKMK', () => {
  it('baris lama tanpa kolom satuan_takar dibaca sebagai sendok takar', () => {
    const { satuan_takar: _, ...lama } = barisTransvita
    expect(petakanProdukDbKeModel(lama)?.satuanTakar).toBe('sendok_takar')
    expect(satuanSah('ember')).toBe('sendok_takar')
  })

  it('baris sachet dipetakan sebagai sachet', () => {
    expect(petakanProdukDbKeModel(barisTransvita)?.satuanTakar).toBe('sachet')
  })

  it('teks takaran menyebut sachet, bukan sendok', () => {
    const produk = petakanProdukDbKeModel(barisTransvita)!
    const hasil = hitungTakaran({ produk, mode: 'dari_target', frekuensiPerHari: 2, targetKkal: 330 })
    expect(hasil.sendokPerSaji).toBe(1)
    const teks = ringkasanTakaran(hasil)
    expect(teks).toContain('1 sachet Transvita')
    expect(teks).toContain('2 sachet/hari')
    expect(teks).not.toMatch(/sendok/)
    expect(keteranganProduk(hasil)).toContain('per sachet')

    const jadwal = susunJadwal({ hasil, masihASI: false })
    const slot = jadwal.slot.find((s) => s.jenis === 'pkmk')!
    expect(bacaSlotJadwal(slot, produk.nama).biasa).toContain('1 sachet dalam')
  })

  it('takaran sachet selalu bilangan bulat', () => {
    const produk = petakanProdukDbKeModel(barisTransvita)!
    for (const target of [100, 250, 400, 610]) {
      const hasil = hitungTakaran({ produk, mode: 'dari_target', frekuensiPerHari: 3, targetKkal: target })
      expect(Number.isInteger(hasil.sendokPerSaji)).toBe(true)
    }
  })

  it('peringatan memakai nama satuan produk', () => {
    const produk = petakanProdukDbKeModel(barisTransvita)!
    const hasil = hitungTakaran({ produk, mode: 'dari_target', frekuensiPerHari: 3, targetKkal: 400 })
    const teks = bacaSeluruhPeringatan(hasil).map((p) => p.pesan + p.saran).join(' ')
    expect(teks).not.toMatch(/sendok/)
  })

  it('produk sendok takar tetap menulis "sendok takar"', () => {
    const produk = petakanProdukDbKeModel({ ...barisTransvita, satuan_takar: undefined, sendok_per_saji: 5, kkal_per_saji: 270, ml_per_saji: 180, ml_air_per_sendok: 28 })!
    const hasil = hitungTakaran({ produk, mode: 'dari_takaran', frekuensiPerHari: 3, targetKkal: 800, sendokPerSaji: 5 })
    expect(ringkasanTakaran(hasil)).toContain('5 sendok takar')
    expect(namaSatuan(undefined)).toBe('sendok takar')
  })

  it('validasi admin menerima Transvita sebagai sachet', () => {
    const hasil = skemaProdukPKMKAdmin.safeParse(masukanAdminTransvita)
    expect(hasil.success).toBe(true)
  })

  it('validasi admin menolak Transvita bila diisi sebagai sendok takar (ruang bubuk 30 ml)', () => {
    const hasil = skemaProdukPKMKAdmin.safeParse({ ...masukanAdminTransvita, satuanTakar: 'sendok_takar' })
    expect(hasil.success).toBe(false)
  })

  it('validasi admin menolak satuan yang tidak dikenal', () => {
    const hasil = skemaProdukPKMKAdmin.safeParse({ ...masukanAdminTransvita, satuanTakar: 'gelas' })
    expect(hasil.success).toBe(false)
  })

  it('satuan bawaan adalah sendok takar', () => {
    const { satuanTakar: _, ...tanpa } = masukanAdminTransvita
    const hasil = skemaProdukPKMKAdmin.safeParse({ ...tanpa, sendokPerSaji: 5, kkalPerSaji: 270, mlPerSaji: 180, mlAirPerSendok: 28, densitasKkalPerMl: 1.5 })
    expect(hasil.success && hasil.data.satuanTakar).toBe('sendok_takar')
  })
})
