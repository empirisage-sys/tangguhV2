/**
 * Jadwal makan harian balita beserta jam pemberian PKMK.
 *
 * Bentuknya mengikuti tabel anjuran Kemenkes/IDAI: kisi dua jam dari 06.00
 * sampai 20.00, dengan PKMK disebar merata dan sisanya diisi makan utama serta
 * selingan yang mengandung protein hewani.
 *
 * ATURAN YANG MENGIKAT
 * --------------------
 * Jumlah baris PKMK pada jadwal ini WAJIB sama dengan `frekuensiPerHari` pada
 * takaran, dan energi tiap baris WAJIB sama dengan energi satu saji. Jadwal
 * bukan tabel terpisah yang ditulis tangan — ia turunan dari takaran yang sama.
 * Bila keduanya boleh berbeda, ibu dapat menerima jadwal yang menyuruh memberi
 * PKMK tiga kali sementara resepnya menyebut empat kali.
 *
 * Lapisan ini murni logika: mengembalikan kode jenis, bukan teks siap baca
 * (AGENTS.md 2.4). Teksnya disusun di `teks.ts`.
 */

import type { HasilTakaran } from './hitung'

/** Kisi jam anjuran, dua jam sekali. */
export const JAM_JADWAL = [
  '06.00',
  '08.00',
  '10.00',
  '12.00',
  '14.00',
  '16.00',
  '18.00',
  '20.00',
] as const

/** Indeks kisi yang secara anjuran menjadi makan utama, bila tidak terpakai PKMK. */
const INDEKS_MAKAN_UTAMA = [1, 3, 6] // 08.00, 12.00, 18.00

export type JenisSlot = 'pkmk' | 'makan_utama' | 'selingan' | 'asi'

export type SlotJadwal = {
  jam: string
  jenis: JenisSlot
  /** Hanya untuk jenis `pkmk`: energi satu saji, kkal. */
  kkalPerSaji?: number
  /** Hanya untuk jenis `pkmk`: jumlah sendok takar satu saji. */
  sendokPerSaji?: number
  /** Hanya untuk jenis `pkmk`: volume larutan satu saji, ml. */
  mlPerSaji?: number
}

export type MasukanJadwal = {
  hasil: HasilTakaran
  /** Anak masih mendapat ASI. Menentukan Alternatif 1 atau Alternatif 2. */
  masihASI: boolean
}

export type Jadwal = {
  masihASI: boolean
  /** 1 bila anak masih mendapat ASI, 2 bila tidak. Mengikuti penomoran anjuran. */
  alternatif: 1 | 2
  slot: SlotJadwal[]
}

/**
 * Menyebar `banyak` pemberian secara merata pada kisi sepanjang `panjang`.
 *
 * Untuk 3 kali pada kisi 8 jam hasilnya indeks 0, 4, 7 — yaitu 06.00, 14.00,
 * dan 20.00, persis anjuran yang menjadi rujukan.
 */
export function sebarMerata(banyak: number, panjang: number): number[] {
  const n = Math.max(0, Math.min(banyak, panjang))
  if (n === 0) return []
  if (n === 1) return [0]

  const indeks: number[] = []
  for (let i = 0; i < n; i++) {
    indeks.push(Math.round((i * (panjang - 1)) / (n - 1)))
  }
  return [...new Set(indeks)]
}

/**
 * Menyebar pemberian PKMK sambil mempertahankan waktu makan utama.
 *
 * ==========================================================================
 * TEMUAN AUDIT P-5: PADA 6x SEHARI, KETIGA WAKTU MAKAN UTAMA HILANG
 *
 * `sebarMerata(6, 8)` menghasilkan indeks [0, 1, 3, 4, 6, 7], yang menutup
 * SELURUH `INDEKS_MAKAN_UTAMA` [1, 3, 6]. Jadwal yang tercetak menjadi enam
 * baris PKMK dan dua selingan, tanpa satu pun makan utama — sementara lembar
 * yang sama menuliskan ratusan kkal yang harus datang dari makanan keluarga.
 * Dua selingan tidak dapat memikul angka itu, dan komentar berkas ini sendiri
 * menyatakan ASI tidak menggantikan MPASI.
 *
 * Sekarang PKMK didahulukan pada kisi jam yang BUKAN makan utama. Bila
 * frekuensinya melebihi jumlah kisi yang tersedia, waktu makan utama baru
 * dipakai seperlunya — dan sisanya tetap dipertahankan, tidak pernah habis
 * sekaligus. `banyakSlotPkmk` tetap sama dengan `frekuensiPerHari`, sehingga
 * aturan yang mengikat di atas tidak dilanggar.
 * ==========================================================================
 */
export function sebarPkmkTanpaMenghapusMakan(banyak: number, panjang: number): number[] {
  const n = Math.max(0, Math.min(banyak, panjang))
  if (n === 0) return []

  const bukanMakanUtama = Array.from({ length: panjang }, (_, i) => i).filter(
    (i) => !INDEKS_MAKAN_UTAMA.includes(i),
  )

  // Sebar merata pada kisi yang bukan makan utama.
  const terpilih = sebarMerata(Math.min(n, bukanMakanUtama.length), bukanMakanUtama.length).map(
    (k) => bukanMakanUtama[k] as number,
  )

  // Bila masih kurang, ambil waktu makan utama dari yang paling belakang,
  // supaya makan pagi dan makan siang bertahan lebih lama daripada makan malam.
  if (terpilih.length < n) {
    const cadangan = [...INDEKS_MAKAN_UTAMA].sort((a, b) => b - a)
    for (const i of cadangan) {
      if (terpilih.length >= n) break
      terpilih.push(i)
    }
  }

  return [...new Set(terpilih)].sort((a, b) => a - b)
}

/**
 * Menyusun jadwal harian dari satu hasil takaran.
 *
 * Seluruh angka PKMK pada jadwal berasal dari `hasil`, tidak dihitung ulang.
 */
export function susunJadwal({ hasil, masihASI }: MasukanJadwal): Jadwal {
  const indeksPkmk = new Set(
    sebarPkmkTanpaMenghapusMakan(hasil.frekuensiPerHari, JAM_JADWAL.length),
  )

  const kkalPerSaji = hasil.sendokPerSaji * hasil.kkalPerSendok

  const slot: SlotJadwal[] = JAM_JADWAL.map((jam, i) => {
    if (indeksPkmk.has(i)) {
      return {
        jam,
        jenis: 'pkmk',
        kkalPerSaji,
        sendokPerSaji: hasil.sendokPerSaji,
        mlPerSaji: hasil.mlLarutanPerSaji,
      }
    }
    if (INDEKS_MAKAN_UTAMA.includes(i)) {
      return { jam, jenis: 'makan_utama' }
    }
    return { jam, jenis: 'selingan' }
  })

  // Anak yang masih mendapat ASI: selingan digantikan ASI sesuai permintaan.
  // Makan utama tetap dipertahankan, karena ASI tidak menggantikan MPASI.
  if (masihASI) {
    for (const s of slot) {
      if (s.jenis === 'selingan') s.jenis = 'asi'
    }
  }

  return { masihASI, alternatif: masihASI ? 1 : 2, slot }
}

/** Banyaknya baris PKMK pada jadwal. Dipakai untuk memastikan jadwal dan takaran sejalan. */
export function banyakSlotPkmk(jadwal: Jadwal): number {
  return jadwal.slot.filter((s) => s.jenis === 'pkmk').length
}

/** Banyaknya waktu makan utama yang bertahan. Nol berarti jadwalnya tidak masuk akal. */
export function banyakMakanUtama(jadwal: Jadwal): number {
  return jadwal.slot.filter((s) => s.jenis === 'makan_utama').length
}
