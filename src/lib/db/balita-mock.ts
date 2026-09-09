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
  /**
   * Kebutuhan energi tumbuh kejar, kkal per hari, dari kolom
   * `skrining.kalori_catchup_kkal`. WAJIB ada di bentuk riwayat karena panel
   * PKMK menurunkan seluruh takarannya dari angka ini; tanpa itu, layar dahulu
   * memakai angka literal 770 sementara server memakai angka sebenarnya.
   * Lihat temuan audit P-1.
   */
  kaloriCatchUpKkal?: number | null
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
  createdBy?: string | null
  riwayat: SkriningRiwayatItem[]
}

/**
 * Basis data balita kosong (Data riil dicatat melalui menu Tambah Balita Baru / Supabase).
 */
export const SAMPLE_BALITA_DATABASE: BalitaDetail[] = []

export function cariBalitaById(id: string): BalitaDetail | undefined {
  return SAMPLE_BALITA_DATABASE.find((b) => b.id === id)
}
