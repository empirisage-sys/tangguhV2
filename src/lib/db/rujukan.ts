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
 */

export type StatusRujukan = 'diajukan' | 'diterima' | 'selesai' | 'batal'

export type RujukanDetail = {
  id: string
  balitaId: string
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
  diajukanOlehPeran: string
  masaAksesHari: number // Standar: 90 hari
  // Catatan Balasan dari Spesialis RS
  tanggalDiterima?: string
  tanggalSelesai?: string
  namaDokterSpesialis?: string
  diagnosisDefinitifRS?: string
  tatalaksanaLanjutan?: string
  catatanBalasan?: string
  rekomendasiPKMK?: string
}

export const SAMPLE_RUJUKAN_DATABASE: RujukanDetail[] = []

let runtimeRujukan: RujukanDetail[] = [...SAMPLE_RUJUKAN_DATABASE]

export function ambilSemuaRujukan(): RujukanDetail[] {
  return runtimeRujukan
}

export function cariRujukanById(id: string): RujukanDetail | undefined {
  return runtimeRujukan.find((r) => r.id === id)
}

export function cariRujukanByBalitaId(balitaId: string): RujukanDetail | undefined {
  return runtimeRujukan.find((r) => r.balitaId === balitaId && r.status !== 'batal')
}

export function tambahRujukan(data: Omit<RujukanDetail, 'id' | 'status' | 'tanggalPengajuan' | 'masaAksesHari'>): RujukanDetail {
  const baru: RujukanDetail = {
    ...data,
    id: `ruj-${Date.now().toString().slice(-6)}`,
    status: 'diajukan',
    tanggalPengajuan: new Date().toISOString().slice(0, 10),
    masaAksesHari: 90,
  }
  runtimeRujukan = [baru, ...runtimeRujukan]
  return baru
}

export function tanggapiRujukan(
  id: string,
  pembaruan: {
    status: StatusRujukan
    namaDokterSpesialis?: string
    diagnosisDefinitifRS?: string
    tatalaksanaLanjutan?: string
    catatanBalasan?: string
    rekomendasiPKMK?: string
  },
): RujukanDetail | undefined {
  const target = runtimeRujukan.find((r) => r.id === id)
  if (!target) return undefined

  const updated: RujukanDetail = {
    ...target,
    ...pembaruan,
    tanggalDiterima: target.tanggalDiterima || new Date().toISOString().slice(0, 10),
    tanggalSelesai: pembaruan.status === 'selesai' ? new Date().toISOString().slice(0, 10) : target.tanggalSelesai,
  }

  runtimeRujukan = runtimeRujukan.map((r) => (r.id === id ? updated : r))
  return updated
}
