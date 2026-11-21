/**
 * Modul Rujukan Medis Balita Stunting / Gizi Buruk (Puskesmas -> RSUD -> Rujuk Balik).
 *
 * Alur Kerja Klinis Terintegrasi:
 * 1. POSYANDU: Kader mendeteksi BB/TB < -3 SD / Gizi Buruk / Edema -> Banner Red Flag tidak dapat ditutup.
 * 2. PUSKESMAS: Dokter memeriksa riwayat & kurva, memilih RSUD tujuan, menulis alasan,
 *    dan menyetujui hak akses rekam medis 90 hari bagi rumah sakit rujukan.
 * 3. RUMAH SAKIT: Spesialis Anak membuka daftar "Pasien Rujukan", melihat seluruh riwayat
 *    antropometri dan kurva WHO lengkap sejak lahir, melakukan pemeriksaan lanjutan,
 *    dan mengisi catatan balasan rujukan.
 * 4. PUSKESMAS: Dokter menerima catatan balasan dan rekomendasi tatalaksana (rujuk balik).
 *
 * ==========================================================================
 * RUJUKAN TERSIMPAN DI DATABASE (November 2026)
 *
 * Sebelumnya berkas ini menyimpan rujukan pada senarai di memori modul. Rujukan
 * hilang setiap kali halaman dimuat ulang, dan karena penulisan terjadi di
 * peramban dokter puskesmas, dokter spesialis anak di rumah sakit tidak pernah
 * menerimanya. Pembacaan kini ada di `rujukan-server.ts`, penulisan di
 * `src/app/(aplikasi)/rujukan/actions.ts`, dan wewenang ditegakkan policy RLS
 * serta trigger `jaga_perubahan_rujukan` (migrasi 20261121000000).
 *
 * Berkas ini hanya memuat tipe dan pemetaan murni, sehingga aman diimpor dari
 * komponen klien maupun server.
 * ==========================================================================
 */
import { hitungUmur } from '@/lib/zscore/umur'

export type StatusRujukan = 'diajukan' | 'diterima' | 'selesai' | 'batal'

/** Masa akses rumah sakit tujuan terhadap data balita (AGENTS.md 3.6). */
export const MASA_AKSES_RUJUKAN_HARI = 90

export type RujukanDetail = {
  id: string
  balitaId: string
  /** `false` bila data balita tidak lagi dapat dibaca (misalnya masa akses 90 hari habis). */
  balitaTerbaca: boolean
  namaBalita: string
  nik?: string
  tanggalLahir: string
  jenisKelamin: 'L' | 'P'
  umurBulan: number
  namaIbu?: string
  noHpOrtu?: string
  alamat?: string
  puskesmasId: string
  namaPuskesmas: string
  namaKabupaten: string
  rsTujuanId: string
  namaRsTujuan: string
  alasanRujukan: string
  diagnosisAwal: string
  status: StatusRujukan
  tanggalPengajuan: string
  diajukanOlehNama: string
  masaAksesHari: number
  /** Tanggal akhir masa akses rumah sakit (YYYY-MM-DD). */
  aksesBerakhir: string
  aksesAktif: boolean
  // Catatan balasan dari spesialis RS
  tanggalDiterima?: string
  tanggalSelesai?: string
  namaDokterSpesialis?: string
  diagnosisDefinitifRS?: string
  tatalaksanaLanjutan?: string
  catatanBalasan?: string
  rekomendasiPKMK?: string
}

/** Rumah sakit yang dapat dipilih sebagai tujuan rujukan. */
export type RumahSakitPilihan = {
  id: string
  nama: string
  /** `usulan` = nama diketik pendaftar dan belum dinormalkan admin. */
  status: 'master' | 'usulan'
}

/** Kolom rujukan beserta relasinya. Satu tempat, supaya tidak berbeda antar kueri. */
export const KOLOM_RUJUKAN = `
  id, balita_id, status, tujuan, alasan, diagnosis_awal, diajukan_oleh_nama,
  puskesmas_id, rs_tujuan_id, created_at, diterima_pada, selesai_pada,
  nama_dokter_spesialis, diagnosis_definitif_rs, tatalaksana_lanjutan,
  rekomendasi_pkmk, catatan_balasan,
  balita:balita_id ( nama, nik, tanggal_lahir, jenis_kelamin, nama_ibu, no_hp_ortu, alamat,
                     kabupaten:kabupaten_id ( nama ) ),
  puskesmas:puskesmas_id ( nama ),
  rs:rs_tujuan_id ( nama )
`

function satu(nilai: unknown): Record<string, unknown> | null {
  if (Array.isArray(nilai)) return satu(nilai[0])
  return nilai && typeof nilai === 'object' ? (nilai as Record<string, unknown>) : null
}
function teks(nilai: unknown): string | undefined {
  return typeof nilai === 'string' && nilai.trim() !== '' ? nilai : undefined
}
function tanggal(nilai: unknown): string | undefined {
  return typeof nilai === 'string' && nilai.length >= 10 ? nilai.slice(0, 10) : undefined
}
function tambahHari(tgl: string, hari: number): string {
  const d = new Date(tgl + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + hari)
  return d.toISOString().slice(0, 10)
}

/**
 * Memetakan satu baris `rujukan` (dengan relasi `KOLOM_RUJUKAN`) ke bentuk layar.
 * `hariIni` (YYYY-MM-DD) dipakai untuk umur dan masa akses, agar fungsi ini murni.
 */
export function petakanRujukan(baris: Record<string, unknown>, hariIni: string): RujukanDetail {
  const balita = satu(baris.balita)
  const tanggalLahir = tanggal(balita?.tanggal_lahir) ?? ''
  const tanggalPengajuan = tanggal(baris.created_at) ?? hariIni
  const aksesBerakhir = tambahHari(tanggalPengajuan, MASA_AKSES_RUJUKAN_HARI)
  const status = (['diajukan', 'diterima', 'selesai', 'batal'] as const).includes(
    baris.status as StatusRujukan,
  )
    ? (baris.status as StatusRujukan)
    : 'diajukan'

  let umurBulan = 0
  if (tanggalLahir && tanggalLahir <= hariIni) {
    umurBulan = Math.floor(hitungUmur(tanggalLahir, hariIni).bulan)
  }

  return {
    id: String(baris.id),
    balitaId: String(baris.balita_id),
    balitaTerbaca: Boolean(balita),
    namaBalita: teks(balita?.nama) ?? 'Data balita tidak dapat dibaca',
    nik: teks(balita?.nik),
    tanggalLahir,
    jenisKelamin: balita?.jenis_kelamin === 'P' ? 'P' : 'L',
    umurBulan,
    namaIbu: teks(balita?.nama_ibu),
    noHpOrtu: teks(balita?.no_hp_ortu),
    alamat: teks(balita?.alamat),
    puskesmasId: String(baris.puskesmas_id ?? ''),
    namaPuskesmas: teks(satu(baris.puskesmas)?.nama) ?? '-',
    namaKabupaten: teks(satu(balita?.kabupaten)?.nama) ?? '-',
    rsTujuanId: String(baris.rs_tujuan_id ?? ''),
    namaRsTujuan: teks(satu(baris.rs)?.nama) ?? teks(baris.tujuan) ?? '-',
    alasanRujukan: teks(baris.alasan) ?? '',
    diagnosisAwal: teks(baris.diagnosis_awal) ?? '',
    status,
    tanggalPengajuan,
    diajukanOlehNama: teks(baris.diajukan_oleh_nama) ?? '-',
    masaAksesHari: MASA_AKSES_RUJUKAN_HARI,
    aksesBerakhir,
    aksesAktif: status !== 'batal' && hariIni < aksesBerakhir,
    tanggalDiterima: tanggal(baris.diterima_pada),
    tanggalSelesai: tanggal(baris.selesai_pada),
    namaDokterSpesialis: teks(baris.nama_dokter_spesialis),
    diagnosisDefinitifRS: teks(baris.diagnosis_definitif_rs),
    tatalaksanaLanjutan: teks(baris.tatalaksana_lanjutan),
    catatanBalasan: teks(baris.catatan_balasan),
    rekomendasiPKMK: teks(baris.rekomendasi_pkmk),
  }
}

/** Rujukan yang masih berjalan (belum selesai dan belum batal). */
export function rujukanBerjalan(r: Pick<RujukanDetail, 'status'>): boolean {
  return r.status === 'diajukan' || r.status === 'diterima'
}
