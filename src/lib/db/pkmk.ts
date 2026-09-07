/**
 * Adaptor Master Data PKMK untuk Kompatibilitas Database & Modul Admin.
 *
 * Mengarahkan dan menghubungkan data produk ke `src/lib/pkmk/`.
 *
 * ==========================================================================
 * SATU SUMBER KEBENARAN (Keputusan D-5, temuan audit T-3)
 *
 * Hanya angka LABEL yang dibaca dari basis data:
 *   kkal_per_saji, sendok_per_saji, ml_per_saji
 *
 * Seluruh angka turunan DIHITUNG di sini dan tidak pernah dibaca dari kolom
 * simpanan, karena kolom simpanan terbukti menyimpang dari label pada baris
 * yang sama. Pada data seed:
 *   - densitas tersimpan 1,00 kkal/ml untuk 4 dari 5 produk, padahal
 *     kkal_per_saji / ml_per_saji berkisar 0,89 sampai 2,00
 *   - Nutrinidrink tersimpan 1,50 padahal labelnya 300/150 = 2,00 (-25%)
 *   - ml_per_saji berselisih dengan sendok_per_saji x ml_air_per_sendok pada
 *     4 dari 5 baris, sampai 100% pada Nutrinidrink
 *
 * `ml_air_per_sendok` TETAP dibaca, tetapi hanya sebagai petunjuk penyiapan
 * yang ditampilkan kepada ibu. Ia BUKAN volume larutan jadi: bubuk menempati
 * ruang, sehingga air 30 ml per sendok tidak menghasilkan larutan 30 ml per
 * sendok. Seluruh perhitungan volume memakai `mlLarutanPerSendok` yang
 * diturunkan dari ml_per_saji.
 *
 * `periksaKonsistensiProduk` melaporkan selisih itu supaya admin melihatnya,
 * bukan menyembunyikannya.
 * ==========================================================================
 */

import {
  PRODUK_PKMK,
  type ProdukPKMK as ProdukPKMKCore,
  type LabelProdukPKMK,
  produkById,
  produkUntukUmur,
  PERINGATAN_DATA_PRODUK,
} from '@/lib/pkmk/produk'

export type ProdukPKMK = ProdukPKMKCore & {
  mlPerSaji?: number
  /** Air per sendok menurut label. Petunjuk penyiapan, BUKAN volume larutan. */
  mlAirPerSendok?: number
  kkalPerMl?: number
  anjuranKlinis?: string
  isActive?: boolean
  proteinGPer100ml?: number | null
  gramPerSendokTakar?: number | null
  maksUsiaBulan?: number | null
  createdAt?: string
}

export const PRODUK_PKMK_LIST: ProdukPKMK[] = PRODUK_PKMK as ProdukPKMK[]
export { produkById, produkUntukUmur, PERINGATAN_DATA_PRODUK }

/** Nilai bawaan yang dipakai HANYA bila kolom label benar-benar kosong. */
const ML_PER_SAJI_BAWAAN = 180

/**
 * Membaca sebuah kolom angka dengan tegas.
 *
 * Mengembalikan `null` bila kolom tidak berisi angka terhingga. Sengaja TIDAK
 * memakai pola `Number(x) || bawaan`: pola itu memperlakukan 0 sebagai kosong
 * dan menebak nilai bawaan secara senyap. Pada baris dengan `sendok_per_saji`
 * kosong, pola lama menghasilkan 1 sendok sehingga Nutrinidrink 300 kkal per
 * saji terbaca 300 kkal PER SENDOK — sepuluh kali lipat, tanpa satu pun
 * peringatan. Lihat temuan audit T-6.
 */
function angka(nilai: unknown): number | null {
  if (nilai === null || nilai === undefined || nilai === '') return null
  const n = Number(nilai)
  return Number.isFinite(n) ? n : null
}

/**
 * Menghitung kkal per sendok takar dari kalori per saji dan jumlah sendok.
 * Mengembalikan `null` bila masukannya tidak sah, bukan 0.
 */
export function hitungKkalPerSendok(
  kkalPerSaji: number | null,
  sendokPerSaji: number | null,
): number | null {
  if (kkalPerSaji === null || sendokPerSaji === null) return null
  if (!(kkalPerSaji > 0) || !(sendokPerSaji > 0)) return null
  return Number((kkalPerSaji / sendokPerSaji).toFixed(2))
}

export class BarisProdukTidakSahError extends Error {
  constructor(
    readonly id: string,
    readonly nama: string,
    readonly medan: string,
  ) {
    super(`Baris produk PKMK "${nama}" (${id}) tidak sah: ${medan}`)
    this.name = 'BarisProdukTidakSahError'
  }
}

/**
 * Pemetaan baris dari database Supabase (snake_case) ke tipe ProdukPKMK.
 *
 * Mengembalikan `null` bila baris tidak memuat angka label yang wajib, supaya
 * baris rusak DIHILANGKAN dari daftar peresepan alih-alih tampil dengan angka
 * tebakan. Pemanggil wajib menangani `null`.
 */
export function petakanProdukDbKeModel(row: unknown): ProdukPKMK | null {
  if (typeof row !== 'object' || row === null) return null
  const r = row as Record<string, unknown>

  const kkalPerSaji = angka(r.kkal_per_saji)
  const sendokPerSaji = angka(r.sendok_per_saji)
  const mlLarutanPerSaji =
    angka(r.ml_per_saji) ?? angka(r.ml_larutan_per_saji) ?? ML_PER_SAJI_BAWAAN

  // Angka label yang wajib. Tanpa keduanya, tidak ada satu pun angka takaran
  // yang dapat dihitung, dan menebaknya lebih berbahaya daripada menolak.
  const kkalPerSendok = hitungKkalPerSendok(kkalPerSaji, sendokPerSaji)
  if (kkalPerSaji === null || sendokPerSaji === null || kkalPerSendok === null) {
    return null
  }
  if (!(mlLarutanPerSaji > 0)) return null

  // Seluruh angka turunan dihitung, tidak pernah dibaca dari kolom simpanan.
  const mlLarutanPerSendok = mlLarutanPerSaji / sendokPerSaji
  const densitasKkalPerMl = kkalPerSaji / mlLarutanPerSaji

  const catatan =
    (typeof r.anjuran_klinis === 'string' && r.anjuran_klinis) ||
    (typeof r.catatan_klinis === 'string' && r.catatan_klinis) ||
    'Periksa label kemasan untuk indikasi usia dan cara penyiapan.'

  const minUsiaBulan = angka(r.min_usia_bulan)
  const maksUsiaBulan = angka(r.maks_usia_bulan)

  return {
    id: String(r.id ?? ''),
    nama: String(r.nama ?? ''),
    merek: typeof r.merek === 'string' ? r.merek : '',
    sendokPerSaji,
    kkalPerSaji,
    mlLarutanPerSaji,
    mlPerSaji: mlLarutanPerSaji,
    // Bawaan 12 bulan bila kolom kosong, bukan NaN. Pola `?? 12` pada versi
    // sebelumnya tidak pernah menangkap NaN karena Number(undefined) adalah
    // NaN, bukan null, sehingga "≥ NaN bln" bisa lolos ke tampilan dan
    // `produkUntukUmur` menyingkirkan produk itu tanpa jejak (temuan T-8).
    minUsiaBulan: minUsiaBulan ?? 12,
    maksUsiaBulan,
    catatanKlinis: catatan,
    anjuranKlinis: catatan,
    kkalPerSendok,
    mlLarutanPerSendok,
    mlAirPerSendok: angka(r.ml_air_per_sendok) ?? mlLarutanPerSendok,
    densitasKkalPerMl,
    kkalPerMl: densitasKkalPerMl,
    proteinGPer100ml: angka(r.protein_g_per_100ml),
    gramPerSendokTakar: angka(r.gram_per_sendok_takar),
    isActive: r.is_active === undefined || r.is_active === null ? true : Boolean(r.is_active),
    createdAt: typeof r.created_at === 'string' ? r.created_at : undefined,
  }
}

/** Memetakan sekumpulan baris, menyingkirkan yang tidak sah. */
export function petakanDaftarProdukDb(rows: unknown[]): {
  produk: ProdukPKMK[]
  jumlahDitolak: number
} {
  const produk: ProdukPKMK[] = []
  let jumlahDitolak = 0
  for (const row of rows) {
    const model = petakanProdukDbKeModel(row)
    if (model) produk.push(model)
    else jumlahDitolak += 1
  }
  return { produk, jumlahDitolak }
}

export type SelisihKonsistensi = {
  medan: 'densitas' | 'volume_saji'
  nilaiTersimpan: number
  nilaiLabel: number
  selisihPersen: number
}

/** Toleransi selisih yang masih dianggap wajar, dalam persen. */
export const TOLERANSI_KONSISTENSI_PERSEN = { densitas: 5, volumeSaji: 10 } as const

/**
 * Membandingkan kolom simpanan dengan angka turunan label.
 *
 * Dipakai halaman admin untuk MENAMPILKAN selisihnya, bukan menyembunyikannya.
 * Perhitungan tidak pernah memakai kolom simpanan (lihat kepala berkas).
 */
export function periksaKonsistensiProduk(row: unknown): SelisihKonsistensi[] {
  if (typeof row !== 'object' || row === null) return []
  const r = row as Record<string, unknown>

  const kkalPerSaji = angka(r.kkal_per_saji)
  const sendokPerSaji = angka(r.sendok_per_saji)
  const mlPerSaji = angka(r.ml_per_saji) ?? angka(r.ml_larutan_per_saji)
  const hasil: SelisihKonsistensi[] = []

  const densitasTersimpan = angka(r.densitas_kkal_per_ml) ?? angka(r.kkal_per_ml)
  if (densitasTersimpan !== null && kkalPerSaji !== null && mlPerSaji !== null && mlPerSaji > 0) {
    const label = kkalPerSaji / mlPerSaji
    const selisih = ((densitasTersimpan - label) / label) * 100
    if (Math.abs(selisih) > TOLERANSI_KONSISTENSI_PERSEN.densitas) {
      hasil.push({
        medan: 'densitas',
        nilaiTersimpan: Number(densitasTersimpan.toFixed(2)),
        nilaiLabel: Number(label.toFixed(2)),
        selisihPersen: Number(selisih.toFixed(1)),
      })
    }
  }

  const mlAirPerSendok = angka(r.ml_air_per_sendok)
  if (mlAirPerSendok !== null && sendokPerSaji !== null && mlPerSaji !== null && mlPerSaji > 0) {
    const rekonstruksi = sendokPerSaji * mlAirPerSendok
    const selisih = ((rekonstruksi - mlPerSaji) / mlPerSaji) * 100
    if (Math.abs(selisih) > TOLERANSI_KONSISTENSI_PERSEN.volumeSaji) {
      hasil.push({
        medan: 'volume_saji',
        nilaiTersimpan: rekonstruksi,
        nilaiLabel: mlPerSaji,
        selisihPersen: Number(selisih.toFixed(1)),
      })
    }
  }

  return hasil
}
