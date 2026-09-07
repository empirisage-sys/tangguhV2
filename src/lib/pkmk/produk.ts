/**
 * Data produk PKMK (Pangan Olahan untuk Keperluan Medis Khusus).
 *
 * ATURAN MODUL INI
 * ----------------
 * Hanya angka yang benar-benar tercetak pada label kemasan yang boleh ditulis
 * tangan di sini: berapa sendok takar per saji, berapa kkal per saji, dan berapa
 * ml larutan jadi per saji. Seluruh angka turunan — kkal per sendok, ml larutan
 * per sendok, densitas energi — DIHITUNG dari ketiganya.
 *
 * Purwarupa lama memakai angka pukul rata 25 kkal per sendok dan 30 ml air per
 * sendok untuk SELURUH produk. Tidak ada satu pun produk yang bernilai 25 kkal,
 * dan nilai ml per sendok sebenarnya berkisar 15 sampai 45. Konstanta seperti itu
 * tidak boleh muncul lagi di mana pun.
 *
 * PERINGATAN DATA: angka label di bawah disalin dari purwarupa lama dan BELUM
 * dicocokkan dengan kemasan produk yang benar-benar beredar di lapangan.
 * Wajib diverifikasi dietisien sebelum dipakai untuk asuhan gizi nyata.
 */

/** Angka mentah sebagaimana tercetak pada label kemasan. */
export type LabelProdukPKMK = {
  id: string
  nama: string
  merek: string
  /** Jumlah sendok takar untuk satu saji, menurut label. */
  sendokPerSaji: number
  /** Energi satu saji dalam kkal, menurut label. */
  kkalPerSaji: number
  /** Volume LARUTAN JADI satu saji dalam ml, menurut label. */
  mlLarutanPerSaji: number
  /** Umur minimum pemakaian dalam bulan, menurut label. */
  minUsiaBulan: number
  catatanKlinis: string
}

/** Produk beserta seluruh angka turunannya. */
export type ProdukPKMK = LabelProdukPKMK & {
  /** kkalPerSaji / sendokPerSaji. Tidak pernah dipatok. */
  kkalPerSendok: number
  /** mlLarutanPerSaji / sendokPerSaji. Tidak pernah dipatok. */
  mlLarutanPerSendok: number
  /** kkalPerSaji / mlLarutanPerSaji. */
  densitasKkalPerMl: number
}

const LABEL_PRODUK: LabelProdukPKMK[] = [
  {
    id: 'pkmk-1',
    nama: 'SGM Gain 100',
    merek: 'SGM',
    sendokPerSaji: 5,
    kkalPerSaji: 100,
    mlLarutanPerSaji: 90,
    minUsiaBulan: 12,
    catatanKlinis: 'Periksa label kemasan untuk indikasi usia dan cara penyiapan.',
  },
  {
    id: 'pkmk-2',
    nama: 'SGM Optigrow',
    merek: 'SGM',
    sendokPerSaji: 4,
    kkalPerSaji: 160,
    mlLarutanPerSaji: 180,
    minUsiaBulan: 12,
    catatanKlinis: 'Periksa label kemasan untuk indikasi usia dan cara penyiapan.',
  },
  {
    id: 'pkmk-3',
    nama: 'DanGro Gain&Grow',
    merek: 'Danone',
    sendokPerSaji: 5,
    kkalPerSaji: 180,
    mlLarutanPerSaji: 180,
    minUsiaBulan: 12,
    catatanKlinis: 'Periksa label kemasan untuk indikasi usia dan cara penyiapan.',
  },
  {
    id: 'pkmk-4',
    nama: 'PediaComplete',
    merek: 'Kalbe',
    sendokPerSaji: 5,
    kkalPerSaji: 200,
    mlLarutanPerSaji: 190,
    minUsiaBulan: 12,
    catatanKlinis: 'Periksa label kemasan untuk indikasi usia dan cara penyiapan.',
  },
  {
    id: 'pkmk-5',
    nama: 'Nutrinidrink',
    merek: 'Nutricia',
    sendokPerSaji: 10,
    kkalPerSaji: 300,
    mlLarutanPerSaji: 150,
    minUsiaBulan: 12,
    catatanKlinis:
      'Densitas energi tinggi. Periksa label kemasan untuk indikasi usia dan cara penyiapan.',
  },
]

function turunkan(label: LabelProdukPKMK): ProdukPKMK {
  return {
    ...label,
    kkalPerSendok: label.kkalPerSaji / label.sendokPerSaji,
    mlLarutanPerSendok: label.mlLarutanPerSaji / label.sendokPerSaji,
    densitasKkalPerMl: label.kkalPerSaji / label.mlLarutanPerSaji,
  }
}

export const PRODUK_PKMK: ProdukPKMK[] = LABEL_PRODUK.map(turunkan)

/**
 * Peringatan yang WAJIB tampil pada setiap layar yang memuat angka takaran PKMK.
 *
 * Tidak dicetak pada lembar asuhan gizi PDF, atas permintaan pemilik aplikasi.
 */
export const PERINGATAN_DATA_PRODUK =
  'Data produk (kalori dan volume per sendok takar) belum diverifikasi terhadap ' +
  'label kemasan yang beredar. Cocokkan dengan kemasan sebelum dipakai.'

/** Menyaring produk yang sesuai umur balita dalam bulan. */
export function produkUntukUmur(umurBulan: number): ProdukPKMK[] {
  if (!Number.isFinite(umurBulan)) return []
  return PRODUK_PKMK.filter((p) => umurBulan >= p.minUsiaBulan)
}

/** Mencari produk berdasarkan id. Mengembalikan null bila tidak ada. */
export function produkById(id: string): ProdukPKMK | null {
  return PRODUK_PKMK.find((p) => p.id === id) ?? null
}
