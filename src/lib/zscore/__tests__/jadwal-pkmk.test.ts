import { describe, it, expect } from 'vitest'
import { produkById, PRODUK_PKMK } from '@/lib/pkmk/produk'
import { hitungTakaran } from '@/lib/pkmk/hitung'
import { susunJadwal, sebarMerata, banyakSlotPkmk, JAM_JADWAL } from '@/lib/pkmk/jadwal'
import { bacaSlotJadwal, judulJadwal } from '@/lib/pkmk/teks'
import { buatPdfLembarAsuhanGizi } from '@/lib/ekspor/pdf-asuhan-gizi'

const optigrow = produkById('pkmk-2')!

const hasil3x = hitungTakaran({
  produk: optigrow, mode: 'dari_takaran', frekuensiPerHari: 3, sendokPerSaji: 3, targetKkal: 600,
})

describe('sebarMerata', () => {
  it('3 pemberian pada kisi 8 jam jatuh di 06.00, 14.00, dan 20.00 sesuai anjuran', () => {
    expect(sebarMerata(3, 8)).toEqual([0, 4, 7])
    expect(sebarMerata(3, 8).map((i) => JAM_JADWAL[i])).toEqual(['06.00', '14.00', '20.00'])
  })

  it('1 pemberian jatuh di jam pertama', () => {
    expect(sebarMerata(1, 8)).toEqual([0])
  })

  it('2 pemberian jatuh di ujung-ujung hari', () => {
    expect(sebarMerata(2, 8).map((i) => JAM_JADWAL[i])).toEqual(['06.00', '20.00'])
  })

  it('tidak pernah melebihi panjang kisi dan tidak pernah berulang', () => {
    for (let n = 1; n <= 10; n++) {
      const hasil = sebarMerata(n, 8)
      expect(hasil.length).toBeLessThanOrEqual(8)
      expect(new Set(hasil).size).toBe(hasil.length)
      expect(Math.max(...hasil)).toBeLessThan(8)
    }
  })

  it('mengembalikan kosong untuk nol pemberian', () => {
    expect(sebarMerata(0, 8)).toEqual([])
  })
})

describe('susunJadwal', () => {
  const jadwal = susunJadwal({ hasil: hasil3x, masihASI: false })

  it('menghasilkan delapan baris kisi dua jam', () => {
    expect(jadwal.slot).toHaveLength(8)
    expect(jadwal.slot.map((s) => s.jam)).toEqual([...JAM_JADWAL])
  })

  it('baris PKMK persis sebanyak frekuensi pada takaran', () => {
    expect(banyakSlotPkmk(jadwal)).toBe(hasil3x.frekuensiPerHari)
  })

  it('menyusun ulang pola anjuran: PKMK, makan utama, dan selingan', () => {
    expect(jadwal.slot.map((s) => s.jenis)).toEqual([
      'pkmk', 'makan_utama', 'selingan', 'makan_utama',
      'pkmk', 'selingan', 'makan_utama', 'pkmk',
    ])
  })

  it('energi tiap baris PKMK sama dengan energi satu saji pada takaran', () => {
    const perSaji = hasil3x.sendokPerSaji * hasil3x.kkalPerSendok
    for (const s of jadwal.slot.filter((x) => x.jenis === 'pkmk')) {
      expect(s.kkalPerSaji).toBe(perSaji)
      expect(s.sendokPerSaji).toBe(hasil3x.sendokPerSaji)
      expect(s.mlPerSaji).toBe(hasil3x.mlLarutanPerSaji)
    }
  })

  it('total energi seluruh baris PKMK sama dengan energi harian takaran', () => {
    const total = jadwal.slot.reduce((n, s) => n + (s.kkalPerSaji ?? 0), 0)
    expect(total).toBe(hasil3x.kkalDiberikan)
  })

  it('jadwal dan takaran tidak pernah berselisih untuk frekuensi 1 sampai 6', () => {
    for (let f = 1; f <= 6; f++) {
      const h = hitungTakaran({
        produk: optigrow, mode: 'dari_takaran', frekuensiPerHari: f, sendokPerSaji: 4, targetKkal: 700,
      })
      const j = susunJadwal({ hasil: h, masihASI: false })
      expect(banyakSlotPkmk(j)).toBe(f)
      expect(j.slot.reduce((n, s) => n + (s.kkalPerSaji ?? 0), 0)).toBe(h.kkalDiberikan)
    }
  })

  it('anak yang masih ASI memakai Alternatif 1 dan selingan diganti ASI', () => {
    const j = susunJadwal({ hasil: hasil3x, masihASI: true })
    expect(j.alternatif).toBe(1)
    expect(j.slot.some((s) => s.jenis === 'asi')).toBe(true)
    expect(j.slot.some((s) => s.jenis === 'selingan')).toBe(false)
    // Makan utama tetap ada: ASI tidak menggantikan MPASI.
    expect(j.slot.some((s) => s.jenis === 'makan_utama')).toBe(true)
    // Jumlah PKMK tidak berubah oleh status ASI.
    expect(banyakSlotPkmk(j)).toBe(hasil3x.frekuensiPerHari)
  })

  it('anak yang tidak ASI memakai Alternatif 2', () => {
    expect(jadwal.alternatif).toBe(2)
    expect(judulJadwal(jadwal)).toContain('Alternatif 2')
    expect(judulJadwal(susunJadwal({ hasil: hasil3x, masihASI: true }))).toContain('Alternatif 1')
  })
})

describe('teks baris jadwal', () => {
  const jadwal = susunJadwal({ hasil: hasil3x, masihASI: false })

  it('baris PKMK menyebut energi satu saji, bukan energi harian', () => {
    const pkmk = jadwal.slot.find((s) => s.jenis === 'pkmk')!
    const teks = bacaSlotJadwal(pkmk, optigrow.nama)
    expect(teks.tebal).toBe('Intervensi Nutrisi PDK/PKMK 120 kkal')
    expect(teks.tebal).not.toContain('360')
    expect(teks.biasa).toContain('3 sendok takar')
    expect(teks.biasa).toContain('135 ml')
  })

  it('baris makan utama dan selingan memakai kalimat anjuran', () => {
    expect(bacaSlotJadwal(jadwal.slot[1]!, optigrow.nama).biasa).toContain('protein hewani')
    expect(bacaSlotJadwal(jadwal.slot[2]!, optigrow.nama).biasa).toContain('Selingan')
  })
})

describe('jadwal pada lembar PDF', () => {
  const identitas = {
    namaBalita: 'Putra',
    tataLaksana: 'PKMK + observasi 2 minggu',
    totalKebutuhanKkal: 750,
  }

  it('mencetak tabel jadwal beserta jam-jamnya', async () => {
    const berkas = await buatPdfLembarAsuhanGizi({ ...identitas, masihASI: false }, hasil3x)
    const isi = new TextDecoder('latin1').decode(berkas)
    expect(isi).toContain('Alternatif 2')
    expect(isi).toContain('Jenis nutrisi')
    expect(isi).toContain('06.00')
    expect(isi).toContain('20.00')
    expect(isi).toContain('Intervensi Nutrisi PDK/PKMK')
  })

  it('mencetak Alternatif 1 bila anak masih mendapat ASI', async () => {
    const berkas = await buatPdfLembarAsuhanGizi({ ...identitas, masihASI: true }, hasil3x)
    const isi = new TextDecoder('latin1').decode(berkas)
    expect(isi).toContain('Alternatif 1')
    expect(isi).toContain('ASI sesuai permintaan')
  })
})

describe('lembar tetap satu halaman', () => {
  it('seluruh gabungan produk, frekuensi, sendok, dan status ASI muat satu halaman', async () => {
    let duaHalaman = 0
    for (const produk of PRODUK_PKMK) {
      for (let f = 1; f <= 6; f++) {
        for (const s of [1, 3, 8, 15]) {
          for (const masihASI of [true, false]) {
           for (const umurBulan of [13, 19, 24, 55]) {
            const h = hitungTakaran({
              produk, mode: 'dari_takaran', frekuensiPerHari: f, sendokPerSaji: s, targetKkal: 700,
            })
            const berkas = await buatPdfLembarAsuhanGizi(
              {
                namaBalita: 'Nama Balita Yang Cukup Panjang',
                umurBulan,
                tataLaksana: 'PKMK + observasi 2 minggu',
                totalKebutuhanKkal: 900,
                masihASI,
              },
              h,
            )
            if (new TextDecoder('latin1').decode(berkas).includes('Halaman 2 dari')) duaHalaman++
           }
          }
        }
      }
    }
    expect(duaHalaman).toBe(0)
  }, 60_000)
})
