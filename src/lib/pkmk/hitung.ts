/**
 * Perhitungan takaran saji PKMK.
 *
 * CACAT YANG DICEGAH MODUL INI
 * ----------------------------
 * Pada purwarupa lama, antarmuka memperlakukan tiga hal sebagai masukan bebas:
 * persentase target, frekuensi per hari, dan sendok per saji. Ketiganya tidak
 * bebas — begitu dua ditentukan, yang ketiga sudah tertentu:
 *
 *     energi = sendok per saji x frekuensi x kkal per sendok
 *
 * Akibatnya kartu hasil menuliskan 600 kkal sementara resep yang tercetak hanya
 * memberi 360 kkal. Anak meminum takarannya, bukan angka di kartu.
 *
 * Modul ini hanya mengizinkan SATU arah perhitungan pada satu waktu, dan energi
 * SELALU dihitung ulang dari takaran akhir setelah pembulatan sendok.
 *
 * Lapisan ini murni logika: tidak mengembalikan teks yang dibaca pengguna
 * maupun nama kelas CSS (AGENTS.md 2.4). Peringatan dikembalikan sebagai kode
 * beserta angkanya; teksnya disusun di `teks.ts`.
 */

import type { ProdukPKMK } from './produk'

/** Ambang yang MENUNGGU VERIFIKASI DIETISIEN. */
export const BATAS = {
  /** Volume larutan per saji yang masih wajar untuk balita, dalam ml. */
  mlPerSajiWajarMaks: 250,
  /** Selisih terhadap target yang masih dapat diterima, dalam persen. */
  toleransiPersen: 10,
  /** Batas atas sendok takar per saji yang masih masuk akal. */
  sendokPerSajiMaks: 15,
  sendokPerSajiMin: 1,
  frekuensiMin: 1,
  frekuensiMaks: 6,
} as const

export type ModeTakaran = 'dari_takaran' | 'dari_target'

export type NadaPeringatan = 'waspada' | 'bahaya'

export type KodePeringatan =
  | 'kurang_dari_target'
  | 'lebih_dari_target'
  | 'volume_per_saji_berlebih'
  | 'target_tidak_tercapai'

export type Peringatan = {
  kode: KodePeringatan
  nada: NadaPeringatan
  /** Angka pendukung untuk disusun menjadi kalimat di lapisan tampilan. */
  angka: Record<string, number>
}

export type MasukanTakaran = {
  produk: ProdukPKMK
  mode: ModeTakaran
  frekuensiPerHari: number
  /** Target energi PKMK dalam kkal. Dipakai kedua mode sebagai acuan. */
  targetKkal: number
  /** Wajib pada mode `dari_takaran`; diabaikan pada mode `dari_target`. */
  sendokPerSaji?: number
}

export type HasilTakaran = {
  produk: ProdukPKMK
  mode: ModeTakaran
  frekuensiPerHari: number
  sendokPerSaji: number
  sendokPerHari: number
  kkalPerSendok: number
  mlLarutanPerSendok: number
  /** Energi yang BENAR-BENAR diberikan takaran ini. Selalu sendokPerHari x kkalPerSendok. */
  kkalDiberikan: number
  targetKkal: number
  /** kkalDiberikan - targetKkal. Negatif berarti kurang dari target. */
  selisihKkal: number
  persenTerhadapTarget: number
  mlLarutanPerSaji: number
  mlLarutanPerHari: number
  peringatan: Peringatan[]
}

function jepit(nilai: number, min: number, maks: number): number {
  return Math.min(maks, Math.max(min, nilai))
}

function bulatkanSatuDesimal(nilai: number): number {
  return Math.round(nilai * 10) / 10
}

/**
 * Menghitung takaran saji dua arah.
 *
 * - `dari_takaran`: dietisien menentukan frekuensi dan sendok per saji;
 *   yang dihitung adalah energi yang diberikan dan persennya terhadap target.
 * - `dari_target`: dietisien menentukan target energi dan frekuensi;
 *   sendok per saji dihitung lalu DIBULATKAN, dan energi dihitung ulang dari
 *   sendok yang sudah dibulatkan itu — bukan dari target.
 */
export function hitungTakaran(masukan: MasukanTakaran): HasilTakaran {
  const { produk, mode, targetKkal } = masukan

  const frekuensiPerHari = Math.round(
    jepit(masukan.frekuensiPerHari, BATAS.frekuensiMin, BATAS.frekuensiMaks),
  )

  const kkalPerSendok = produk.kkalPerSendok
  const mlLarutanPerSendok = produk.mlLarutanPerSendok

  let sendokPerSaji: number
  let targetTidakTercapai = false

  if (mode === 'dari_target') {
    const idealPerSaji = targetKkal / (frekuensiPerHari * kkalPerSendok)
    const dibulatkan = Math.round(idealPerSaji)
    sendokPerSaji = jepit(dibulatkan, BATAS.sendokPerSajiMin, BATAS.sendokPerSajiMaks)
    targetTidakTercapai = dibulatkan > BATAS.sendokPerSajiMaks
  } else {
    sendokPerSaji = Math.round(
      jepit(masukan.sendokPerSaji ?? 1, BATAS.sendokPerSajiMin, BATAS.sendokPerSajiMaks),
    )
  }

  const sendokPerHari = sendokPerSaji * frekuensiPerHari

  // INVARIAN: energi selalu turunan dari takaran akhir. Tidak ada jalan lain.
  const kkalDiberikan = sendokPerHari * kkalPerSendok

  const selisihKkal = kkalDiberikan - targetKkal
  const persenTerhadapTarget =
    targetKkal > 0 ? bulatkanSatuDesimal((kkalDiberikan / targetKkal) * 100) : 0

  const mlLarutanPerSaji = sendokPerSaji * mlLarutanPerSendok
  const mlLarutanPerHari = mlLarutanPerSaji * frekuensiPerHari

  const peringatan: Peringatan[] = []

  if (targetKkal > 0) {
    const selisihPersen = Math.abs((selisihKkal / targetKkal) * 100)
    if (selisihPersen > BATAS.toleransiPersen) {
      if (selisihKkal < 0) {
        peringatan.push({
          kode: 'kurang_dari_target',
          nada: 'bahaya',
          angka: {
            kurangKkal: Math.abs(selisihKkal),
            persen: bulatkanSatuDesimal(selisihPersen),
            toleransiPersen: BATAS.toleransiPersen,
          },
        })
      } else {
        peringatan.push({
          kode: 'lebih_dari_target',
          nada: 'waspada',
          angka: {
            lebihKkal: selisihKkal,
            persen: bulatkanSatuDesimal(selisihPersen),
            toleransiPersen: BATAS.toleransiPersen,
          },
        })
      }
    }
  }

  if (mlLarutanPerSaji > BATAS.mlPerSajiWajarMaks) {
    peringatan.push({
      kode: 'volume_per_saji_berlebih',
      nada: 'waspada',
      angka: {
        mlPerSaji: bulatkanSatuDesimal(mlLarutanPerSaji),
        batasMl: BATAS.mlPerSajiWajarMaks,
        frekuensiSaran: Math.min(BATAS.frekuensiMaks, frekuensiPerHari + 1),
      },
    })
  }

  if (targetTidakTercapai) {
    peringatan.push({
      kode: 'target_tidak_tercapai',
      nada: 'bahaya',
      angka: {
        sendokMaks: BATAS.sendokPerSajiMaks,
        kkalDiberikan,
        targetKkal,
      },
    })
  }

  return {
    produk,
    mode,
    frekuensiPerHari,
    sendokPerSaji,
    sendokPerHari,
    kkalPerSendok,
    mlLarutanPerSendok,
    kkalDiberikan,
    targetKkal,
    selisihKkal,
    persenTerhadapTarget,
    mlLarutanPerSaji: bulatkanSatuDesimal(mlLarutanPerSaji),
    mlLarutanPerHari: bulatkanSatuDesimal(mlLarutanPerHari),
    peringatan,
  }
}

export type PilihanTakaran = HasilTakaran & { volumeWajar: boolean }

/**
 * Menyusun beberapa pilihan frekuensi untuk satu target, mendahulukan yang
 * volume per sajinya masih wajar, lalu yang paling dekat dengan target.
 *
 * Menggantikan satu angka tunggal yang seolah pasti.
 */
export function pilihanTakaran(produk: ProdukPKMK, targetKkal: number): PilihanTakaran[] {
  const daftar: PilihanTakaran[] = []

  for (let f = BATAS.frekuensiMin; f <= BATAS.frekuensiMaks; f++) {
    const hasil = hitungTakaran({
      produk,
      mode: 'dari_target',
      frekuensiPerHari: f,
      targetKkal,
    })
    daftar.push({ ...hasil, volumeWajar: hasil.mlLarutanPerSaji <= BATAS.mlPerSajiWajarMaks })
  }

  return daftar.sort((a, b) => {
    if (a.volumeWajar !== b.volumeWajar) return a.volumeWajar ? -1 : 1
    const selisihA = Math.abs(a.selisihKkal)
    const selisihB = Math.abs(b.selisihKkal)
    if (selisihA !== selisihB) return selisihA - selisihB
    return a.frekuensiPerHari - b.frekuensiPerHari
  })
}

/**
 * Sisa energi yang harus dipenuhi dari makanan keluarga atau ASI.
 *
 * Dihitung dari energi yang BENAR-BENAR diberikan PKMK, bukan dari target.
 * Purwarupa lama memakai target, sehingga ibu diberi tahu perlu menyiapkan
 * 150 kkal padahal kekurangan sebenarnya 390 kkal.
 */
export function sisaDariMakanan(totalKebutuhanKkal: number, hasil: HasilTakaran): number {
  return Math.max(0, Math.round(totalKebutuhanKkal - hasil.kkalDiberikan))
}
