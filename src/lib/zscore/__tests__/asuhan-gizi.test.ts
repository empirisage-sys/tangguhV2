import { describe, it, expect } from 'vitest'
import { produkById } from '@/lib/pkmk/produk'
import { hitungTakaran } from '@/lib/pkmk/hitung'
import { keBarisAsuhanGizi, barisAsuhanKonsisten } from '@/lib/db/asuhan-gizi'
import { skemaAsuhanGizi, bacaFormAsuhanGizi } from '@/lib/validasi/asuhan-gizi'
import { buatPdfLembarAsuhanGizi } from '@/lib/ekspor/pdf-asuhan-gizi'

const optigrow = produkById('pkmk-2')!
const UUID_A = '11111111-2222-3333-4444-555555555555'
const UUID_B = '66666666-7777-8888-9999-aaaaaaaaaaaa'

/** Kasus tangkapan layar: 3x sehari, 3 sendok, target 600, kebutuhan total 750. */
const hasilKasusLama = hitungTakaran({
  produk: optigrow,
  mode: 'dari_takaran',
  frekuensiPerHari: 3,
  sendokPerSaji: 3,
  targetKkal: 600,
})

const konteks = {
  balitaId: UUID_A,
  skriningId: UUID_B,
  dietisienId: UUID_A,
  puskesmasId: UUID_B,
  tataLaksana: 'PKMK + observasi 2 minggu',
  targetPersen: 80,
  totalKebutuhanKkal: 750,
}

describe('pemetaan baris asuhan_gizi', () => {
  const baris = keBarisAsuhanGizi(konteks, hasilKasusLama)

  it('menyimpan energi yang diberikan, bukan target', () => {
    expect(baris.kalori_diberikan).toBe(360)
    expect(baris.kalori_target).toBe(600)
    expect(baris.kalori_diberikan).not.toBe(baris.kalori_target)
  })

  it('menyimpan takaran yang menghasilkan energi itu', () => {
    expect(baris.frekuensi_per_hari).toBe(3)
    expect(baris.sendok_per_saji).toBe(3)
    expect(baris.sendok_per_hari).toBe(9)
  })

  it('sisa kalori makanan keluarga dihitung dari energi nyata', () => {
    expect(baris.sisa_kalori_makanan).toBe(390)
    expect(baris.sisa_kalori_makanan).not.toBe(150)
  })

  it('menyimpan volume larutan dari produk, bukan angka tetap', () => {
    expect(baris.ml_larutan_per_saji).toBe(135)
    expect(baris.ml_larutan_per_hari).toBe(405)
  })

  it('menyimpan kode produk agar resep dapat ditelusuri', () => {
    expect(baris.produk_pkmk_kode).toBe('pkmk-2')
  })

  it('menyimpan ringkasan dan peringatan untuk diaudit kemudian', () => {
    expect(baris.ringkasan_takaran).toContain('360 kkal')
    expect(baris.peringatan_takaran.map((p) => p.kode)).toContain('kurang_dari_target')
  })

  it('baris hasil pemetaan selalu lolos pemeriksaan konsistensi', () => {
    expect(barisAsuhanKonsisten(baris, optigrow.kkalPerSendok)).toBe(true)
  })

  it('pemeriksaan konsistensi menolak energi yang tidak sesuai takarannya', () => {
    const dipalsukan = { ...baris, kalori_diberikan: 600 }
    expect(barisAsuhanKonsisten(dipalsukan, optigrow.kkalPerSendok)).toBe(false)
  })

  it('pemeriksaan konsistensi menolak sendok per hari yang tidak sesuai', () => {
    const dipalsukan = { ...baris, sendok_per_hari: 15 }
    expect(barisAsuhanKonsisten(dipalsukan, optigrow.kkalPerSendok)).toBe(false)
  })

  it('pemeriksaan konsistensi menolak selisih yang tidak sesuai', () => {
    const dipalsukan = { ...baris, kalori_selisih: 0 }
    expect(barisAsuhanKonsisten(dipalsukan, optigrow.kkalPerSendok)).toBe(false)
  })

  it('konsisten untuk seluruh gabungan frekuensi dan sendok', () => {
    for (let f = 1; f <= 6; f++) {
      for (let s = 1; s <= 15; s++) {
        const h = hitungTakaran({
          produk: optigrow, mode: 'dari_takaran', frekuensiPerHari: f, sendokPerSaji: s, targetKkal: 600,
        })
        expect(barisAsuhanKonsisten(keBarisAsuhanGizi(konteks, h), optigrow.kkalPerSendok)).toBe(true)
      }
    }
  })
})

describe('skema validasi asuhan gizi', () => {
  const masukanSah = {
    balitaId: UUID_A,
    tataLaksana: 'PKMK + observasi 2 minggu',
    produkId: 'pkmk-2',
    mode: 'dari_takaran' as const,
    targetPersen: 80,
    frekuensiPerHari: 3,
    sendokPerSaji: 3,
  }

  it('menerima masukan yang sah', () => {
    expect(skemaAsuhanGizi.safeParse(masukanSah).success).toBe(true)
  })

  it('MENOLAK angka hasil yang dikirim klien — hasil hanya boleh dihitung server', () => {
    const hasil = skemaAsuhanGizi.safeParse({
      ...masukanSah,
      kkalDiberikan: 600,
      mlLarutanPerSaji: 90,
      persenTerhadapTarget: 100,
    })
    expect(hasil.success).toBe(true)
    // Kunci hasil tidak ikut terbawa, sehingga tidak mungkin tersimpan apa adanya.
    expect(Object.keys(hasil.success ? hasil.data : {})).not.toContain('kkalDiberikan')
    expect(Object.keys(hasil.success ? hasil.data : {})).not.toContain('mlLarutanPerSaji')
  })

  it('menolak identitas balita yang bukan UUID', () => {
    expect(skemaAsuhanGizi.safeParse({ ...masukanSah, balitaId: 'balita-1' }).success).toBe(false)
  })

  it('menolak persentase target di luar 0 sampai 100', () => {
    expect(skemaAsuhanGizi.safeParse({ ...masukanSah, targetPersen: 150 }).success).toBe(false)
  })

  it('menolak sendok per saji melebihi batas', () => {
    expect(skemaAsuhanGizi.safeParse({ ...masukanSah, sendokPerSaji: 99 }).success).toBe(false)
  })

  it('menolak frekuensi di luar batas', () => {
    expect(skemaAsuhanGizi.safeParse({ ...masukanSah, frekuensiPerHari: 9 }).success).toBe(false)
  })

  it('menolak tata laksana kosong', () => {
    expect(skemaAsuhanGizi.safeParse({ ...masukanSah, tataLaksana: '' }).success).toBe(false)
  })

  it('membaca FormData menjadi angka, bukan teks', () => {
    const fd = new FormData()
    fd.set('balitaId', UUID_A)
    fd.set('tataLaksana', 'PKMK + observasi 2 minggu')
    fd.set('produkId', 'pkmk-2')
    fd.set('mode', 'dari_takaran')
    fd.set('targetPersen', '90')
    fd.set('frekuensiPerHari', '3')
    fd.set('sendokPerSaji', '5')
    const dibaca = bacaFormAsuhanGizi(fd)
    expect(dibaca.targetPersen).toBe(90)
    expect(dibaca.sendokPerSaji).toBe(5)
    expect(skemaAsuhanGizi.safeParse(dibaca).success).toBe(true)
  })
})

describe('lembar asuhan gizi PDF', () => {
  const identitas = {
    namaBalita: 'Putra',
    tataLaksana: 'PKMK + observasi 2 minggu',
    totalKebutuhanKkal: 750,
  }

  it('menghasilkan berkas PDF yang sah', async () => {
    const berkas = await buatPdfLembarAsuhanGizi(identitas, hasilKasusLama)
    expect(new TextDecoder().decode(berkas.slice(0, 5))).toBe('%PDF-')
    expect(berkas.byteLength).toBeGreaterThan(1000)
  })

  it('mencetak energi nyata dan takarannya, bukan target', async () => {
    const berkas = await buatPdfLembarAsuhanGizi(identitas, hasilKasusLama)
    const isi = new TextDecoder('latin1').decode(berkas)
    expect(isi).toContain('ENERGI YANG DIBERIKAN TAKARAN INI')
    expect(isi).toContain('360 kkal')
    expect(isi).toContain('3 sendok takar')
  })

  it('setiap cetakan memuat peringatan data produk belum terverifikasi', async () => {
    const berkas = await buatPdfLembarAsuhanGizi(identitas, hasilKasusLama)
    const isi = new TextDecoder('latin1').decode(berkas)
    expect(isi).toContain('belum diverifikasi')
  })

  it('mencetak peringatan kurang dari target', async () => {
    const berkas = await buatPdfLembarAsuhanGizi(identitas, hasilKasusLama)
    const isi = new TextDecoder('latin1').decode(berkas)
    expect(isi).toContain('Perhatian')
  })
})
