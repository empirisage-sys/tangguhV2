/**
 * Pemetaan dari hasil engine ke baris tabel `skrining` di Supabase.
 *
 * Berkas ini adalah satu-satunya tempat nama kolom database disebut, sehingga
 * bila skema berubah hanya berkas ini yang perlu disesuaikan.
 *
 * Kolomnya mengikuti migrasi:
 *   20260819090000_init_tangguh.sql
 *   20260819120000_patch_temuan_telaah.sql
 *
 * ATURAN YANG TIDAK BOLEH DILANGGAR
 * Fungsi ini hanya boleh dipanggil di sisi server, dengan hasil yang dihitung
 * ulang di server dari angka mentah. Jangan pernah memetakan hasil hitung yang
 * dikirim klien lalu menyimpannya apa adanya.
 */
import type { HasilSkrining, PosisiUkur } from '@/lib/zscore/tipe'

/** Nilai enum `posisi_ukur` di Postgres. */
type PosisiUkurDb = 'recumbent' | 'standing' | 'auto'

const PETA_POSISI: Record<PosisiUkur, PosisiUkurDb> = {
  terlentang: 'recumbent',
  berdiri: 'standing',
  otomatis: 'auto',
}

export function posisiKeDb(posisi: PosisiUkur): PosisiUkurDb {
  return PETA_POSISI[posisi]
}

export function posisiDariDb(posisi: PosisiUkurDb): PosisiUkur {
  if (posisi === 'recumbent') return 'terlentang'
  if (posisi === 'standing') return 'berdiri'
  return 'otomatis'
}

export type KonteksSkrining = {
  clientUuid: string
  balitaId: string
  tanggalPeriksa: string
  beratKg: number
  panjangCm: number
  posisiUkur: PosisiUkur
  lilaCm?: number
  lingkarKepalaCm?: number
  edema: boolean
  catatan?: string
  /** Diisi dari profil pengguna, tidak pernah dari masukan formulir. */
  createdBy: string
  posyanduId: string
  faskesId?: string
  puskesmasId: string
  kabupatenId: string
  asalData: 'input_langsung' | 'sinkronisasi_offline' | 'migrasi_firestore'
  /** Hanya diisi saat migrasi data dari Firestore. */
  refFirestoreId?: string | null
}

/** Bentuk baris yang dikirim ke `supabase.from('skrining').insert(...)`. */
export type BarisSkrining = {
  client_uuid: string
  balita_id: string
  tanggal_periksa: string
  umur_hari: number
  umur_bulan: number
  berat_kg: number
  panjang_cm: number
  posisi_ukur: PosisiUkurDb
  panjang_terkoreksi_cm: number
  lila_cm: number | null
  lingkar_kepala_cm: number | null
  edema: boolean
  z_bbu: number | null
  z_tbu: number | null
  z_bbtb: number | null
  status_bbu: string | null
  status_tbu: string | null
  status_bbtb: string | null
  is_red_flag: boolean
  bb_ideal_kg: number | null
  usia_tinggi_bulan: number | null
  rda_kkal_per_kg: number
  kalori_target_kkal: number
  protein_min_gram: number
  protein_max_gram: number
  kalori_catchup_kkal: number | null
  protein_catchup_min_gram: number | null
  protein_catchup_max_gram: number | null
  kalori_metode: 'pemeliharaan' | 'catch_up'
  di_luar_rentang: boolean
  catatan_di_luar_rentang: string | null
  engine_version: string
  dihitung_di: 'server' | 'client-offline'
  catatan: string | null
  posyandu_id: string
  faskes_id?: string
  puskesmas_id: string
  kabupaten_id: string
  created_by: string
  asal_data: string
  ref_firestore_id: string | null
}

export function keBarisSkrining(
  konteks: KonteksSkrining,
  hasil: HasilSkrining,
): BarisSkrining {
  const fId = konteks.faskesId || konteks.puskesmasId
  return {
    client_uuid: konteks.clientUuid,
    balita_id: konteks.balitaId,
    tanggal_periksa: konteks.tanggalPeriksa,

    umur_hari: hasil.umurHari,
    umur_bulan: hasil.umurBulan,

    berat_kg: konteks.beratKg,
    panjang_cm: konteks.panjangCm,
    posisi_ukur: posisiKeDb(konteks.posisiUkur),
    panjang_terkoreksi_cm: hasil.panjangTerkoreksiCm,
    lila_cm: konteks.lilaCm ?? null,
    lingkar_kepala_cm: konteks.lingkarKepalaCm ?? null,
    edema: konteks.edema,

    z_bbu: hasil.bbu.z,
    z_tbu: hasil.tbu.z,
    z_bbtb: hasil.bbtb.z,
    status_bbu: hasil.statusBBU,
    status_tbu: hasil.statusTBU,
    status_bbtb: hasil.statusBBTB,
    is_red_flag: hasil.isRedFlag,

    bb_ideal_kg: hasil.gizi.beratIdealKg,
    usia_tinggi_bulan: hasil.gizi.usiaTinggiBulan,
    rda_kkal_per_kg: hasil.gizi.rdaPemeliharaanKkalPerKg,
    kalori_target_kkal: hasil.gizi.kaloriPemeliharaanKkal,
    protein_min_gram: hasil.gizi.proteinPemeliharaanMinGram,
    protein_max_gram: hasil.gizi.proteinPemeliharaanMaksGram,
    kalori_catchup_kkal: hasil.gizi.kaloriCatchUpKkal,
    protein_catchup_min_gram: hasil.gizi.proteinCatchUpMinGram,
    protein_catchup_max_gram: hasil.gizi.proteinCatchUpMaksGram,
    kalori_metode: hasil.gizi.metode,

    di_luar_rentang: hasil.diLuarRentang,
    catatan_di_luar_rentang: hasil.catatanDiLuarRentang,

    engine_version: hasil.engineVersion,
    dihitung_di: 'server',
    catatan: konteks.catatan ?? null,

    posyandu_id: konteks.posyanduId,
    faskes_id: fId,
    puskesmas_id: fId,
    kabupaten_id: konteks.kabupatenId,
    created_by: konteks.createdBy,
    asal_data: konteks.asalData,
    ref_firestore_id: konteks.refFirestoreId ?? null,
  }
}

/**
 * Membandingkan hasil hitung klien dengan hasil hitung server.
 *
 * Dipakai saat menerima data dari antrean offline. Klien menghitung agar kader
 * melihat hasil seketika tanpa sinyal; server menghitung ulang sebagai sumber
 * kebenaran. Bila keduanya berselisih lebih dari toleransi, baris tetap disimpan
 * dengan angka dari server, tetapi selisihnya dilaporkan untuk ditelusuri —
 * biasanya pertanda perangkat memakai versi aplikasi yang lama.
 */
export const TOLERANSI_Z = 0.01

export function bandingkanHasil(
  klien: Pick<HasilSkrining, 'bbu' | 'tbu' | 'bbtb' | 'engineVersion'>,
  server: HasilSkrining,
): { cocok: true } | { cocok: false; selisih: string[] } {
  const selisih: string[] = []

  if (klien.engineVersion !== server.engineVersion) {
    selisih.push(
      `versi engine berbeda: perangkat ${klien.engineVersion}, server ${server.engineVersion}`,
    )
  }

  const banding = (nama: string, a: number | null, b: number | null) => {
    if (a === null && b === null) return
    if (a === null || b === null) {
      selisih.push(`${nama}: perangkat ${a ?? 'tidak dinilai'}, server ${b ?? 'tidak dinilai'}`)
      return
    }
    if (Math.abs(a - b) > TOLERANSI_Z) {
      selisih.push(`${nama}: perangkat ${a.toFixed(3)}, server ${b.toFixed(3)}`)
    }
  }

  banding('BB/U', klien.bbu.z, server.bbu.z)
  banding('TB/U', klien.tbu.z, server.tbu.z)
  banding('BB/TB', klien.bbtb.z, server.bbtb.z)

  return selisih.length === 0 ? { cocok: true } : { cocok: false, selisih }
}
