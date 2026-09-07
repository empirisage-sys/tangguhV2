/**
 * Pemetaan hasil takaran PKMK menjadi baris tabel `asuhan_gizi`.
 *
 * Yang disimpan adalah MASUKAN dan HASIL sekaligus. Data lama hanya menyimpan
 * target, sehingga resep yang benar-benar diberikan kepada anak tidak dapat
 * ditelusuri kembali. Dengan kedua sisi tersimpan, siapa pun dapat memeriksa
 * ulang di kemudian hari bahwa energi yang tercatat memang berasal dari takaran
 * yang tercatat.
 */

import type { HasilTakaran } from '@/lib/pkmk/hitung'
import { sisaDariMakanan } from '@/lib/pkmk/hitung'
import { ringkasanTakaran, bacaSeluruhPeringatan } from '@/lib/pkmk/teks'

export type KonteksAsuhanGizi = {
  balitaId: string
  skriningId?: string | null
  dietisienId: string
  puskesmasId: string
  tataLaksana: string
  targetPersen: number
  /** Total kebutuhan energi tumbuh kejar balita, kkal. Dibaca server dari skrining. */
  totalKebutuhanKkal: number
  tanggalEvaluasi?: string | null
  catatan?: string | null
}

export type BarisAsuhanGizi = {
  balita_id: string
  skrining_id: string | null
  dietisien_id: string
  puskesmas_id: string
  diagnosis_gizi: string
  /**
   * Rujukan uuid ke `produk_pkmk`. WAJIB terisi bila produk berasal dari
   * master data, karena inilah kolom yang dipakai penjaga integritas saat
   * admin mencoba menghapus produk.
   *
   * Versi sebelumnya hanya mengisi `produk_pkmk_kode` dan meninggalkan kolom
   * ini NULL pada SETIAP baris, sehingga penjaga penghapusan tidak pernah
   * menemukan satu pun rekam medis dan produk yang sudah diresepkan dapat
   * dihapus permanen. Lihat temuan audit T-0b.
   */
  produk_pkmk_id: string | null
  /** Snapshot kode produk untuk audit, termasuk bila produk kelak dihapus. */
  produk_pkmk_kode: string
  mode_takaran: 'dari_takaran' | 'dari_target'
  frekuensi_per_hari: number
  sendok_per_saji: number
  sendok_per_hari: number
  kalori_persen_target: number
  kalori_target: number
  kalori_diberikan: number
  kalori_selisih: number
  sisa_kalori_makanan: number
  ml_larutan_per_saji: number
  ml_larutan_per_hari: number
  dosis_ml_per_hari: number
  ringkasan_takaran: string
  peringatan_takaran: { kode: string; nada: string; pesan: string }[]
  tanggal_evaluasi: string | null
  catatan: string | null
}

const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Mengembalikan id produk bila ia benar-benar uuid master data.
 *
 * Id daftar cadangan statis berbentuk `pkmk-1`, bukan uuid, dan tidak boleh
 * dimasukkan ke kolom uuid berkendala kunci asing. Kode tersebut tetap
 * tersimpan pada `produk_pkmk_kode` sebagai jejak audit.
 */
export function idProdukUuid(id: string): string | null {
  return POLA_UUID.test(id) ? id : null
}

/**
 * Menyusun baris yang dikirim ke `supabase.from('asuhan_gizi').insert(...)`.
 *
 * Seluruh angka hasil diambil dari objek `HasilTakaran` yang dihitung di server.
 * Tidak ada satu pun yang berasal dari formulir.
 */
export function keBarisAsuhanGizi(
  konteks: KonteksAsuhanGizi,
  hasil: HasilTakaran,
): BarisAsuhanGizi {
  return {
    balita_id: konteks.balitaId,
    skrining_id: konteks.skriningId ?? null,
    dietisien_id: konteks.dietisienId,
    puskesmas_id: konteks.puskesmasId,
    diagnosis_gizi: konteks.tataLaksana,
    produk_pkmk_id: idProdukUuid(hasil.produk.id),
    produk_pkmk_kode: hasil.produk.id,
    mode_takaran: hasil.mode,
    frekuensi_per_hari: hasil.frekuensiPerHari,
    sendok_per_saji: hasil.sendokPerSaji,
    sendok_per_hari: hasil.sendokPerHari,
    kalori_persen_target: konteks.targetPersen,
    kalori_target: Math.round(hasil.targetKkal),
    kalori_diberikan: Math.round(hasil.kkalDiberikan),
    kalori_selisih: Math.round(hasil.selisihKkal),
    sisa_kalori_makanan: sisaDariMakanan(konteks.totalKebutuhanKkal, hasil),
    ml_larutan_per_saji: hasil.mlLarutanPerSaji,
    ml_larutan_per_hari: hasil.mlLarutanPerHari,
    dosis_ml_per_hari: Math.round(hasil.mlLarutanPerHari),
    ringkasan_takaran: ringkasanTakaran(hasil),
    peringatan_takaran: bacaSeluruhPeringatan(hasil).map((p) => ({
      kode: p.kode,
      nada: p.nada,
      pesan: p.pesan,
    })),
    tanggal_evaluasi: konteks.tanggalEvaluasi ?? null,
    catatan: konteks.catatan ?? null,
  }
}

/**
 * Pemeriksaan yang harus tetap benar pada baris mana pun sebelum disimpan.
 *
 * Ini jaring pengaman terakhir terhadap cacat lama: energi yang tercatat wajib
 * sama dengan sendok per hari dikali kalori per sendok produk. Bila suatu saat
 * ada jalur kode yang mengisi baris ini tanpa lewat `hitungTakaran`, pemeriksaan
 * di sini yang akan menangkapnya.
 */
export function barisAsuhanKonsisten(baris: BarisAsuhanGizi, kkalPerSendok: number): boolean {
  const seharusnya = Math.round(baris.sendok_per_hari * kkalPerSendok)
  return (
    baris.sendok_per_hari === baris.sendok_per_saji * baris.frekuensi_per_hari &&
    baris.kalori_diberikan === seharusnya &&
    baris.kalori_selisih === baris.kalori_diberikan - baris.kalori_target
  )
}
