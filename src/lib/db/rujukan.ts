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

export const SAMPLE_RUJUKAN_DATABASE: RujukanDetail[] = [
  {
    id: 'ruj-7571-001',
    balitaId: 'bal-01',
    namaBalita: 'Ahmad Fadel',
    nik: '7571011908240001',
    tanggalLahir: '2024-08-19',
    jenisKelamin: 'L',
    umurBulan: 24,
    namaIbu: 'Siti Rahma',
    noHpOrtu: '081234567890',
    alamat: 'Jl. Palma, Kel. Dulalowo, Kec. Kota Tengah',
    puskesmasId: 'pus-7571-01',
    namaPuskesmas: 'Puskesmas Kota Tengah',
    namaKabupaten: 'Kota Gorontalo',
    rsTujuanId: 'rs-7571-01',
    namaRsTujuan: 'RSUD Prof. Dr. H. Aloei Saboe (RS Rujukan Utama)',
    alasanRujukan: 'Gizi buruk klinis (BB/TB -3.06 SD), stunting berat (-3.00 SD), gagal tumbuh progresif selama 6 bulan terakhir.',
    diagnosisAwal: 'Severe Wasting & Severe Stunting (Failure to Thrive)',
    status: 'diajukan',
    tanggalPengajuan: '2026-08-19',
    diajukanOlehNama: 'dr. Hendra Pratama',
    diajukanOlehPeran: 'Dokter Puskesmas',
    masaAksesHari: 90,
  },
  {
    id: 'ruj-7502-002',
    balitaId: 'bal-03',
    namaBalita: 'Rizky Pratama',
    nik: '7502011908250003',
    tanggalLahir: '2025-08-19',
    jenisKelamin: 'L',
    umurBulan: 12,
    namaIbu: 'Fatimah Yusuf',
    noHpOrtu: '082190123456',
    alamat: 'Desa Kayubulan, Kec. Limboto',
    puskesmasId: 'pus-7502-01',
    namaPuskesmas: 'Puskesmas Limboto',
    namaKabupaten: 'Kabupaten Gorontalo',
    rsTujuanId: 'rs-7502-01',
    namaRsTujuan: 'RSUD MM Dunda Limboto Kab. Gorontalo',
    alasanRujukan: 'Penurunan Z-Score BB/TB drastis (-2.08 SD) dan TB/U pendek (-2.35 SD) dengan riwayat infeksi berulang.',
    diagnosisAwal: 'Moderate Acute Malnutrition with Chronic Infection Risk',
    status: 'selesai',
    tanggalPengajuan: '2026-08-16',
    diajukanOlehNama: 'dr. Sri Wahyuni',
    diajukanOlehPeran: 'Dokter Puskesmas',
    masaAksesHari: 90,
    tanggalDiterima: '2026-08-17',
    tanggalSelesai: '2026-08-18',
    namaDokterSpesialis: 'dr. Andi Kurniawan, Sp.A',
    diagnosisDefinitifRS: 'Underweight sekunder ec ISPA berulang + intake nutrisi suboptimal',
    tatalaksanaLanjutan: 'Pemberian antibiotik oral 5 hari, suplementasi Zinc 20 mg/hari x 14 hari, dan intervensi PKMK Oral Tinggi Kalori.',
    catatanBalasan: 'Kondisi klinis balita stabil. Telah diberikan resep PKMK catch-up growth 100 kkal/100ml. Pasien dirujuk balik ke Puskesmas Limboto untuk pemantauan kenaikan BB mingguan.',
    rekomendasiPKMK: 'PKMK Usia 1-5 Tahun (Target 150 kkal/kgBB/hari), Takaran: 4 sendok takar 3x sehari.',
  },
]

// In-memory runtime storage untuk sesi klien / demo
let runtimeRujukan = [...SAMPLE_RUJUKAN_DATABASE]

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
