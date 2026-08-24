import type { StandarPanjang, StatusBBU, StatusTBU, StatusBBTB } from '@/lib/zscore/tipe'
import type { KunjunganRiwayat } from '@/lib/grafik/seri'

export type SkriningRiwayatItem = KunjunganRiwayat & {
  tanggal: string
  panjangCm: number
  z_bbu: number | null
  z_tbu: number | null
  z_bbtb: number | null
  statusBBU: StatusBBU | null
  statusTBU: StatusTBU | null
  statusBBTB: StatusBBTB | null
  edema?: boolean
  diLuarRentang: boolean
}

export type BalitaDetail = {
  id: string
  nama: string
  nik?: string
  tanggalLahir: string
  jenisKelamin: 'L' | 'P'
  namaIbu?: string
  namaAyah?: string
  noHpOrtu?: string
  alamat?: string
  posyanduId: string
  puskesmasId: string
  kabupatenId: string
  namaPosyandu: string
  namaPuskesmas: string
  namaKabupaten: string
  bbLahirKg?: number
  pbLahirCm?: number
  riwayat: SkriningRiwayatItem[]
}

export const SAMPLE_BALITA_DATABASE: BalitaDetail[] = [
  {
    id: 'bal-01',
    nama: 'Ahmad Fadel',
    nik: '7571011908240001',
    tanggalLahir: '2024-08-19',
    jenisKelamin: 'L',
    namaIbu: 'Siti Rahma',
    namaAyah: 'Ibrahim Fadel',
    noHpOrtu: '081234567890',
    alamat: 'Jl. Palma, Kel. Dulalowo, Kec. Kota Tengah',
    posyanduId: 'pos-7571-01-01',
    puskesmasId: 'pus-7571-01',
    kabupatenId: 'kab-7571',
    namaPosyandu: 'Posyandu Mawar Dulalowo',
    namaPuskesmas: 'Puskesmas Kota Tengah',
    namaKabupaten: 'Kota Gorontalo',
    bbLahirKg: 3.1,
    pbLahirCm: 49.0,
    riwayat: [
      {
        tanggal: '2025-02-19',
        tanggalPeriksa: '2025-02-19',
        umurBulan: 6,
        beratKg: 7.2,
        panjangCm: 67.0,
        panjangTerkoreksiCm: 67.0,
        standarPanjang: 'terlentang',
        zBbu: -0.85,
        zTbu: -0.72,
        zBbtb: -0.64,
        z_bbu: -0.85,
        z_tbu: -0.72,
        z_bbtb: -0.64,
        statusBBU: 'berat_badan_normal',
        statusTBU: 'normal',
        statusBBTB: 'gizi_baik',
        diLuarRentang: false,
      },
      {
        tanggal: '2025-08-19',
        tanggalPeriksa: '2025-08-19',
        umurBulan: 12,
        beratKg: 8.1,
        panjangCm: 72.5,
        panjangTerkoreksiCm: 72.5,
        standarPanjang: 'terlentang',
        zBbu: -1.95,
        zTbu: -1.88,
        zBbtb: -1.45,
        z_bbu: -1.95,
        z_tbu: -1.88,
        z_bbtb: -1.45,
        statusBBU: 'berat_badan_kurang',
        statusTBU: 'normal',
        statusBBTB: 'gizi_baik',
        diLuarRentang: false,
      },
      {
        tanggal: '2026-02-19',
        tanggalPeriksa: '2026-02-19',
        umurBulan: 18,
        beratKg: 8.0,
        panjangCm: 75.0,
        panjangTerkoreksiCm: 75.0,
        standarPanjang: 'terlentang',
        zBbu: -2.85,
        zTbu: -2.45,
        zBbtb: -2.6,
        z_bbu: -2.85,
        z_tbu: -2.45,
        z_bbtb: -2.6,
        statusBBU: 'berat_badan_kurang',
        statusTBU: 'pendek',
        statusBBTB: 'gizi_kurang',
        diLuarRentang: false,
      },
      {
        tanggal: '2026-08-19',
        tanggalPeriksa: '2026-08-19',
        umurBulan: 24,
        beratKg: 8.0,
        panjangCm: 78.0,
        panjangTerkoreksiCm: 78.0,
        standarPanjang: 'berdiri',
        zBbu: -3.61,
        zTbu: -3.0,
        zBbtb: -3.06,
        z_bbu: -3.61,
        z_tbu: -3.0,
        z_bbtb: -3.06,
        statusBBU: 'berat_badan_sangat_kurang',
        statusTBU: 'sangat_pendek',
        statusBBTB: 'gizi_buruk',
        diLuarRentang: false,
      },
    ],
  },
  {
    id: 'bal-02',
    nama: 'Nurul Aini',
    nik: '7571011902250002',
    tanggalLahir: '2025-02-19',
    jenisKelamin: 'P',
    namaIbu: 'Amina Mokodompis',
    namaAyah: 'Hasan Basri',
    noHpOrtu: '085240123456',
    alamat: 'Kel. Pulubala, Kec. Kota Tengah',
    posyanduId: 'pos-7571-01-02',
    puskesmasId: 'pus-7571-01',
    kabupatenId: 'kab-7571',
    namaPosyandu: 'Posyandu Melati Pulubala',
    namaPuskesmas: 'Puskesmas Kota Tengah',
    namaKabupaten: 'Kota Gorontalo',
    bbLahirKg: 2.9,
    pbLahirCm: 48.0,
    riwayat: [
      {
        tanggal: '2025-08-19',
        tanggalPeriksa: '2025-08-19',
        umurBulan: 6,
        beratKg: 7.3,
        panjangCm: 65.7,
        panjangTerkoreksiCm: 65.7,
        standarPanjang: 'terlentang',
        zBbu: 0.1,
        zTbu: 0.0,
        zBbtb: 0.2,
        z_bbu: 0.1,
        z_tbu: 0.0,
        z_bbtb: 0.2,
        statusBBU: 'berat_badan_normal',
        statusTBU: 'normal',
        statusBBTB: 'gizi_baik',
        diLuarRentang: false,
      },
      {
        tanggal: '2026-02-19',
        tanggalPeriksa: '2026-02-19',
        umurBulan: 12,
        beratKg: 8.9,
        panjangCm: 74.0,
        panjangTerkoreksiCm: 74.0,
        standarPanjang: 'terlentang',
        zBbu: 0.05,
        zTbu: 0.02,
        zBbtb: 0.1,
        z_bbu: 0.05,
        z_tbu: 0.02,
        z_bbtb: 0.1,
        statusBBU: 'berat_badan_normal',
        statusTBU: 'normal',
        statusBBTB: 'gizi_baik',
        diLuarRentang: false,
      },
      {
        tanggal: '2026-08-18',
        tanggalPeriksa: '2026-08-18',
        umurBulan: 18,
        beratKg: 10.2,
        panjangCm: 80.7,
        panjangTerkoreksiCm: 80.7,
        standarPanjang: 'terlentang',
        zBbu: 0.12,
        zTbu: -0.15,
        zBbtb: 0.35,
        z_bbu: 0.12,
        z_tbu: -0.15,
        z_bbtb: 0.35,
        statusBBU: 'berat_badan_normal',
        statusTBU: 'normal',
        statusBBTB: 'gizi_baik',
        diLuarRentang: false,
      },
    ],
  },
  {
    id: 'bal-03',
    nama: 'Rizky Pratama',
    nik: '7502011908250003',
    tanggalLahir: '2025-08-19',
    jenisKelamin: 'L',
    namaIbu: 'Fatimah Yusuf',
    namaAyah: 'Rizal Pratama',
    noHpOrtu: '082190123456',
    alamat: 'Desa Kayubulan, Kec. Limboto',
    posyanduId: 'pos-7502-01-01',
    puskesmasId: 'pus-7502-01',
    kabupatenId: 'kab-7502',
    namaPosyandu: 'Posyandu Cempaka Kayubulan',
    namaPuskesmas: 'Puskesmas Limboto',
    namaKabupaten: 'Kabupaten Gorontalo',
    bbLahirKg: 3.0,
    pbLahirCm: 48.5,
    riwayat: [
      {
        tanggal: '2026-02-19',
        tanggalPeriksa: '2026-02-19',
        umurBulan: 6,
        beratKg: 7.0,
        panjangCm: 65.0,
        panjangTerkoreksiCm: 65.0,
        standarPanjang: 'terlentang',
        zBbu: -1.1,
        zTbu: -1.3,
        zBbtb: -0.6,
        z_bbu: -1.1,
        z_tbu: -1.3,
        z_bbtb: -0.6,
        statusBBU: 'berat_badan_normal',
        statusTBU: 'normal',
        statusBBTB: 'gizi_baik',
        diLuarRentang: false,
      },
      {
        tanggal: '2026-08-16',
        tanggalPeriksa: '2026-08-16',
        umurBulan: 12,
        beratKg: 7.9,
        panjangCm: 73.0,
        panjangTerkoreksiCm: 73.0,
        standarPanjang: 'terlentang',
        zBbu: -2.15,
        zTbu: -2.35,
        zBbtb: -2.08,
        z_bbu: -2.15,
        z_tbu: -2.35,
        z_bbtb: -2.08,
        statusBBU: 'berat_badan_kurang',
        statusTBU: 'pendek',
        statusBBTB: 'gizi_kurang',
        diLuarRentang: false,
      },
    ],
  },
]

export function cariBalitaById(id: string): BalitaDetail | undefined {
  return SAMPLE_BALITA_DATABASE.find((b) => b.id === id)
}
