/**
 * Kebutuhan kemasan PKMK untuk satu masa peresepan (bawaan 14 hari).
 *
 * Dokter meresepkan susu PKMK dalam satuan kemasan utuh (kaleng/boks 400 g
 * atau 800 g), bukan dalam sendok. Modul ini menerjemahkan takaran harian
 * menjadi jumlah kemasan, SELALU dibulatkan ke atas: membulatkan ke bawah
 * berarti susu habis sebelum kontrol berikutnya.
 *
 *   gram per hari   = satuan takar per hari x gram per satuan takar
 *   gram total      = gram per hari x jumlah hari
 *   jumlah kemasan  = gram total / gram per kemasan, dibulatkan KE ATAS
 *
 * Berat per satuan takar diambil dari label (kolom gram_per_sendok_takar),
 * tidak pernah ditebak. Bila kosong, hasilnya "tidak dapat dihitung".
 *
 * Lapisan logika murni: tidak ada teks untuk pengguna (AGENTS.md 2.4).
 */

/** Ukuran kemasan yang umum beredar, dalam gram. */
export const UKURAN_KEMASAN_UMUM_GRAM = [400, 800] as const

/** Masa peresepan bawaan, dalam hari (kontrol 2 minggu). */
export const DURASI_BAWAAN_HARI = 14

export const PILIHAN_DURASI_HARI = [7, 14, 21, 28, 30] as const

export type MasukanKebutuhan = {
  /** Jumlah satuan takar (sendok/sachet) per hari, dari HasilTakaran.sendokPerHari. */
  satuanPerHari: number
  /** Berat satu satuan takar dalam gram, menurut label. */
  gramPerSatuan: number | null | undefined
  hari: number
  gramPerKemasan: number
}

export type HasilKebutuhan =
  | {
      dapatDihitung: true
      hari: number
      gramPerKemasan: number
      gramPerSatuan: number
      satuanTotal: number
      gramPerHari: number
      gramTotal: number
      /** Jumlah kemasan, dibulatkan ke atas. */
      jumlahKemasan: number
      gramTersedia: number
      /** Bubuk yang tersisa di akhir masa peresepan. */
      sisaGram: number
      /** Jumlah hari penuh yang dicukupi kemasan yang diresepkan. */
      hariCukup: number
    }
  | { dapatDihitung: false; alasan: 'gram_per_satuan_kosong' | 'masukan_tidak_sah' }

function positif(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0
}

/** Pembulatan ke atas yang kebal galat titik mengambang (mis. 1600 / 800 = 2,0000000001). */
function bulatkanKeAtas(n: number): number {
  return Math.ceil(Math.round(n * 1e6) / 1e6)
}

export function hitungKebutuhanKemasan(m: MasukanKebutuhan): HasilKebutuhan {
  if (!positif(m.gramPerSatuan)) return { dapatDihitung: false, alasan: 'gram_per_satuan_kosong' }
  if (!positif(m.satuanPerHari) || !positif(m.hari) || !positif(m.gramPerKemasan)) {
    return { dapatDihitung: false, alasan: 'masukan_tidak_sah' }
  }
  const hari = Math.round(m.hari)
  const gramPerHari = m.satuanPerHari * m.gramPerSatuan
  const gramTotal = gramPerHari * hari
  const jumlahKemasan = Math.max(1, bulatkanKeAtas(gramTotal / m.gramPerKemasan))
  const gramTersedia = jumlahKemasan * m.gramPerKemasan
  return {
    dapatDihitung: true,
    hari,
    gramPerKemasan: m.gramPerKemasan,
    gramPerSatuan: m.gramPerSatuan,
    satuanTotal: m.satuanPerHari * hari,
    gramPerHari,
    gramTotal,
    jumlahKemasan,
    gramTersedia,
    sisaGram: gramTersedia - gramTotal,
    hariCukup: Math.floor(gramTersedia / gramPerHari + 1e-9),
  }
}
