/**
 * Jembatan dari kode kategori engine ke tampilan.
 *
 * Inilah satu-satunya tempat kode kategori seperti `gizi_kurang` diterjemahkan
 * menjadi teks bahasa Indonesia, nada warna, dan nama ikon.
 *
 * Alasan berkas ini ada: aplikasi versi Firebase mengembalikan teks yang dibaca
 * pengguna berikut nama kelas CSS dari lapisan logika, lalu di tempat lain
 * mencocokkan teks itu dengan `includes()`. Pola tersebut menghasilkan penyaring
 * yang tidak pernah cocok karena beda huruf besar-kecil.
 * Lihat TELAAH_KODE_LAMA_TANGGUH_REV1.1.md temuan T-5.
 *
 * Aturannya sekarang tegas:
 *   - Lapisan logika hanya mengenal kode kategori.
 *   - Lapisan tampilan hanya membaca kode kategori, tidak pernah teks.
 *   - Penyaringan dan penghitungan statistik memakai kode, tidak pernah teks.
 */
import type {
  StatusBBTB,
  StatusBBU,
  StatusTBU,
  StatusVelocity,
} from '@/lib/zscore/tipe'

/**
 * Nada warna klinis. Hanya tiga, dan hanya untuk makna medis.
 * Warna merek dan warna aksen tidak boleh dipakai untuk status gizi.
 */
export type NadaKlinis = 'aman' | 'waspada' | 'bahaya' | 'netral'

/** Nama ikon lucide-react. Setiap lencana wajib memuat ikon selain warna. */
export type NamaIkon = 'circle-check' | 'triangle-alert' | 'octagon-alert' | 'circle-help'

export type TampilanStatus = {
  /** Label yang dibaca pengguna. Sentence case, tanpa istilah Inggris. */
  label: string
  /** Keterangan satu kalimat, dipakai di kartu hasil dan laporan cetak. */
  keterangan: string
  nada: NadaKlinis
  ikon: NamaIkon
}

const TIDAK_DINILAI: TampilanStatus = {
  label: 'Tidak dapat dinilai',
  keterangan: 'Data berada di luar rentang standar WHO yang dipakai aplikasi ini.',
  nada: 'netral',
  ikon: 'circle-help',
}

const BBU: Record<StatusBBU, TampilanStatus> = {
  berat_badan_sangat_kurang: {
    label: 'Berat badan sangat kurang',
    keterangan: 'Berat badan menurut umur di bawah -3 SD.',
    nada: 'bahaya',
    ikon: 'octagon-alert',
  },
  berat_badan_kurang: {
    label: 'Berat badan kurang',
    keterangan: 'Berat badan menurut umur antara -3 SD dan -2 SD.',
    nada: 'waspada',
    ikon: 'triangle-alert',
  },
  berat_badan_normal: {
    label: 'Berat badan normal',
    keterangan: 'Berat badan menurut umur berada pada rentang normal.',
    nada: 'aman',
    ikon: 'circle-check',
  },
  risiko_berat_badan_lebih: {
    label: 'Risiko berat badan lebih',
    keterangan: 'Berat badan menurut umur di atas +1 SD.',
    nada: 'waspada',
    ikon: 'triangle-alert',
  },
}

const TBU: Record<StatusTBU, TampilanStatus> = {
  sangat_pendek: {
    label: 'Sangat pendek',
    keterangan: 'Panjang atau tinggi badan menurut umur di bawah -3 SD.',
    nada: 'bahaya',
    ikon: 'octagon-alert',
  },
  pendek: {
    label: 'Pendek',
    keterangan: 'Panjang atau tinggi badan menurut umur antara -3 SD dan -2 SD.',
    nada: 'waspada',
    ikon: 'triangle-alert',
  },
  normal: {
    label: 'Normal',
    keterangan: 'Panjang atau tinggi badan menurut umur berada pada rentang normal.',
    nada: 'aman',
    ikon: 'circle-check',
  },
  tinggi: {
    label: 'Tinggi',
    keterangan: 'Panjang atau tinggi badan menurut umur di atas +3 SD.',
    nada: 'netral',
    ikon: 'circle-help',
  },
}

const BBTB: Record<StatusBBTB, TampilanStatus> = {
  gizi_buruk: {
    label: 'Gizi buruk',
    keterangan: 'Berat badan menurut panjang atau tinggi badan di bawah -3 SD.',
    nada: 'bahaya',
    ikon: 'octagon-alert',
  },
  gizi_kurang: {
    label: 'Gizi kurang',
    keterangan: 'Berat badan menurut panjang atau tinggi badan antara -3 SD dan -2 SD.',
    nada: 'waspada',
    ikon: 'triangle-alert',
  },
  gizi_baik: {
    label: 'Gizi baik',
    keterangan: 'Berat badan menurut panjang atau tinggi badan berada pada rentang normal.',
    nada: 'aman',
    ikon: 'circle-check',
  },
  risiko_gizi_lebih: {
    label: 'Risiko gizi lebih',
    keterangan: 'Berat badan menurut panjang atau tinggi badan antara +1 SD dan +2 SD.',
    nada: 'waspada',
    ikon: 'triangle-alert',
  },
  gizi_lebih: {
    label: 'Gizi lebih',
    keterangan: 'Berat badan menurut panjang atau tinggi badan antara +2 SD dan +3 SD.',
    nada: 'waspada',
    ikon: 'triangle-alert',
  },
  obesitas: {
    label: 'Obesitas',
    keterangan: 'Berat badan menurut panjang atau tinggi badan di atas +3 SD.',
    nada: 'bahaya',
    ikon: 'octagon-alert',
  },
}

const VELOCITY: Record<StatusVelocity, TampilanStatus> = {
  naik: {
    label: 'Naik sesuai standar',
    keterangan: 'Kenaikan berat badan mencapai batas minimal menurut standar.',
    nada: 'aman',
    ikon: 'circle-check',
  },
  tidak_naik: {
    label: 'Tidak naik',
    keterangan: 'Berat badan tidak bertambah atau berkurang sejak penimbangan sebelumnya.',
    nada: 'bahaya',
    ikon: 'octagon-alert',
  },
  growth_faltering: {
    label: 'Kenaikan kurang',
    keterangan: 'Berat badan bertambah, tetapi belum mencapai batas minimal.',
    nada: 'waspada',
    ikon: 'triangle-alert',
  },
  tidak_dapat_dinilai: TIDAK_DINILAI,
}

export function tampilanBBU(status: StatusBBU | null): TampilanStatus {
  return status ? BBU[status] : TIDAK_DINILAI
}

export function tampilanTBU(status: StatusTBU | null): TampilanStatus {
  return status ? TBU[status] : TIDAK_DINILAI
}

export function tampilanBBTB(status: StatusBBTB | null): TampilanStatus {
  return status ? BBTB[status] : TIDAK_DINILAI
}

export function tampilanVelocity(status: StatusVelocity | null): TampilanStatus {
  return status ? VELOCITY[status] : TIDAK_DINILAI
}

/** Nama indikator yang dipakai di kartu hasil dan laporan. */
export const NAMA_INDIKATOR = {
  bbu: 'Berat badan menurut umur',
  tbu: 'Panjang atau tinggi badan menurut umur',
  bbtb: 'Berat badan menurut panjang atau tinggi badan',
} as const

export const SINGKATAN_INDIKATOR = {
  bbu: 'BB/U',
  tbu: 'TB/U',
  bbtb: 'BB/TB',
} as const

/**
 * Kalimat penyangkalan klinis. Wajib tampil di setiap layar hasil dan di
 * setiap dokumen yang dicetak.
 */
export const PENYANGKALAN_KLINIS =
  'Hasil ini adalah alat bantu skrining, bukan pengganti pemeriksaan dan ' +
  'keputusan klinis tenaga kesehatan.'

/**
 * Peringatan yang menyertai angka target tumbuh kejar, selama rumusnya belum
 * ditandatangani nutrisionis.
 */
export const PERINGATAN_CATCH_UP =
  'Target tumbuh kejar adalah usulan perhitungan yang harus diverifikasi ' +
  'dietisien atau dokter sebelum dijadikan dasar terapi.'
