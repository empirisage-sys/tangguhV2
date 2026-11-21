import { describe, expect, it } from 'vitest'
import { hitungKebutuhanKemasan } from '@/lib/pkmk/kebutuhan'
import { ringkasanKebutuhan } from '@/lib/pkmk/teks'
import {
  buatSandiSementara,
  RS_BARU,
  skemaGantiSandiSementara,
  POSYANDU_BARU,
  skemaTambahPenggunaAdmin,
} from '@/lib/validasi/pendaftaran'
import { bacaWajibGantiSandi } from '@/lib/supabase/penjaga'

describe('hitungKebutuhanKemasan', () => {
  it('SGM Optigrow 3x4 sendok (11,5 g) selama 14 hari: 1.932 g = 5 kemasan 400 g', () => {
    const k = hitungKebutuhanKemasan({ satuanPerHari: 12, gramPerSatuan: 11.5, hari: 14, gramPerKemasan: 400 })
    expect(k.dapatDihitung).toBe(true)
    if (!k.dapatDihitung) return
    expect(k.gramTotal).toBeCloseTo(1932)
    expect(k.jumlahKemasan).toBe(5)
    expect(k.sisaGram).toBeCloseTo(68)
    expect(k.hariCukup).toBe(14)
  })

  it('selalu dibulatkan ke atas: 1.932 g dengan kemasan 800 g menjadi 3, bukan 2', () => {
    const k = hitungKebutuhanKemasan({ satuanPerHari: 12, gramPerSatuan: 11.5, hari: 14, gramPerKemasan: 800 })
    expect(k.dapatDihitung && k.jumlahKemasan).toBe(3)
  })

  it('kebutuhan tepat satu kelipatan tidak ditambah satu karena galat pecahan', () => {
    // 4 sendok x 5 g x 20 hari = 400 g tepat
    const k = hitungKebutuhanKemasan({ satuanPerHari: 4, gramPerSatuan: 5, hari: 20, gramPerKemasan: 400 })
    expect(k.dapatDihitung && k.jumlahKemasan).toBe(1)
    const k2 = hitungKebutuhanKemasan({ satuanPerHari: 3, gramPerSatuan: 0.1 * 3, hari: 1000, gramPerKemasan: 900 })
    expect(k2.dapatDihitung && k2.jumlahKemasan).toBe(1)
  })

  it('Transvita 2 sachet/hari (40 g) selama 14 hari: 1.120 g = 3 boks 400 g', () => {
    const k = hitungKebutuhanKemasan({ satuanPerHari: 2, gramPerSatuan: 40, hari: 14, gramPerKemasan: 400 })
    expect(k.dapatDihitung && k.jumlahKemasan).toBe(3)
    const teks = ringkasanKebutuhan(k, 'sachet')
    expect(teks.judul).toBe('Resepkan 3 kemasan 400 g untuk 14 hari')
    expect(teks.rincian).toContain('28 sachet')
    expect(teks.rincian).toContain('1.120 g')
  })

  it('berat per sendok kosong tidak ditebak', () => {
    const k = hitungKebutuhanKemasan({ satuanPerHari: 12, gramPerSatuan: null, hari: 14, gramPerKemasan: 400 })
    expect(k).toEqual({ dapatDihitung: false, alasan: 'gram_per_satuan_kosong' })
    expect(ringkasanKebutuhan(k).rincian).toMatch(/belum diisi/)
  })

  it('ukuran kemasan tidak sah ditolak', () => {
    const k = hitungKebutuhanKemasan({ satuanPerHari: 12, gramPerSatuan: 11.5, hari: 14, gramPerKemasan: Number('') })
    expect(k.dapatDihitung).toBe(false)
  })
})

describe('akun petugas dibuat admin', () => {
  const dasar = {
    peran: 'dokter_spesialis_anak',
    namaLengkap: 'dr. Uji, Sp.A',
    email: 'Uji@RS.go.id',
    noHp: '081234567890',
    noStr: '1234567',
    rumahSakitId: '11111111-1111-4111-8111-111111111111',
    namaRsBaru: '',
    kabupatenId: '',
    sandiSementara: 'Sementara123',
  }

  it('isian lengkap diterima dan email dinormalkan', () => {
    const h = skemaTambahPenggunaAdmin.safeParse(dasar)
    expect(h.success).toBe(true)
    expect(h.success && h.data.email).toBe('uji@rs.go.id')
  })

  it('STR wajib', () => {
    expect(skemaTambahPenggunaAdmin.safeParse({ ...dasar, noStr: '12' }).success).toBe(false)
  })

  it('rumah sakit baru wajib nama dan kabupaten', () => {
    const h = skemaTambahPenggunaAdmin.safeParse({ ...dasar, rumahSakitId: RS_BARU })
    expect(h.success).toBe(false)
    const medan = h.success ? [] : h.error.issues.map((i) => i.path[0])
    expect(medan).toEqual(expect.arrayContaining(['namaRsBaru', 'kabupatenId']))
  })

  const PKM = '22222222-2222-4222-8222-222222222222'
  const POS = '33333333-3333-4333-8333-333333333333'

  it('dokter puskesmas wajib puskesmas dan STR, tanpa rumah sakit', () => {
    const d = { ...dasar, peran: 'dokter', rumahSakitId: '' }
    expect(skemaTambahPenggunaAdmin.safeParse(d).success).toBe(false)
    expect(skemaTambahPenggunaAdmin.safeParse({ ...d, puskesmasId: PKM }).success).toBe(true)
  })

  it('kader tidak wajib STR tetapi wajib posyandu', () => {
    const k = { ...dasar, peran: 'kader', noStr: '', rumahSakitId: '', puskesmasId: PKM }
    expect(skemaTambahPenggunaAdmin.safeParse(k).success).toBe(false)
    expect(skemaTambahPenggunaAdmin.safeParse({ ...k, posyanduId: POS }).success).toBe(true)
    expect(skemaTambahPenggunaAdmin.safeParse({ ...k, posyanduId: POSYANDU_BARU }).success).toBe(false)
    expect(
      skemaTambahPenggunaAdmin.safeParse({ ...k, posyanduId: POSYANDU_BARU, namaPosyanduBaru: 'Melati SIM' }).success,
    ).toBe(true)
  })

  it('peran admin tidak dapat dibuat', () => {
    expect(skemaTambahPenggunaAdmin.safeParse({ ...dasar, peran: 'admin' }).success).toBe(false)
  })

  it('sandi sementara acak 12 karakter, tanpa huruf yang mudah tertukar', () => {
    for (let i = 0; i < 50; i++) {
      const s = buatSandiSementara()
      expect(s).toHaveLength(12)
      expect(s).not.toMatch(/[0O1lI]/)
      expect(s).toMatch(/\d/)
      expect(s).toMatch(/[A-Z]/)
    }
  })

  it('ganti sandi: ulangi wajib sama', () => {
    expect(skemaGantiSandiSementara.safeParse({ sandiBaru: 'abcdefgh', ulangiSandi: 'abcdefgx' }).success).toBe(false)
    expect(skemaGantiSandiSementara.safeParse({ sandiBaru: 'abcdefgh', ulangiSandi: 'abcdefgh' }).success).toBe(true)
  })

  it('penanda wajib ganti sandi hanya dibaca dari app_metadata', () => {
    expect(bacaWajibGantiSandi({ app_metadata: { wajib_ganti_sandi: true } })).toBe(true)
    expect(bacaWajibGantiSandi({ user_metadata: { wajib_ganti_sandi: true } })).toBe(false)
    expect(bacaWajibGantiSandi({ app_metadata: { wajib_ganti_sandi: 'true' } })).toBe(false)
    expect(bacaWajibGantiSandi(null)).toBe(false)
  })
})
