import type { JenisKelamin } from '@/lib/who'

export type { JenisKelamin }

/** Posisi pengukuran panjang atau tinggi badan saat di lapangan. */
export type PosisiUkur = 'terlentang' | 'berdiri' | 'otomatis'

/** Standar antropometri yang berlaku menurut umur balita. */
export type StandarPanjang = 'terlentang' | 'berdiri'

export type StatusBBU =
  | 'berat_badan_sangat_kurang'
  | 'berat_badan_kurang'
  | 'berat_badan_normal'
  | 'risiko_berat_badan_lebih'

export type StatusTBU = 'sangat_pendek' | 'pendek' | 'normal' | 'tinggi'

export type StatusBBTB =
  | 'gizi_buruk'
  | 'gizi_kurang'
  | 'gizi_baik'
  | 'risiko_gizi_lebih'
  | 'gizi_lebih'
  | 'obesitas'

export type StatusVelocity = 'naik' | 'tidak_naik' | 'growth_faltering' | 'tidak_dapat_dinilai'

export type MetodeKalori = 'pemeliharaan' | 'catch_up'

/** Alasan sebuah indikator tidak dapat dinilai. */
export type AlasanTidakDinilai =
  | 'umur_melebihi_60_bulan'
  | 'umur_negatif'
  | 'panjang_di_luar_tabel'
  | 'berat_di_luar_batas_wajar'
  | 'data_tidak_lengkap'

export type InputSkrining = {
  /** Tanggal lahir, format YYYY-MM-DD. */
  tanggalLahir: string
  /** Tanggal pemeriksaan, format YYYY-MM-DD. */
  tanggalPeriksa: string
  jenisKelamin: JenisKelamin
  /** Berat badan dalam kilogram. */
  beratKg: number
  /** Panjang atau tinggi badan terukur dalam sentimeter, sebelum koreksi posisi. */
  panjangCm: number
  /**
   * Posisi saat mengukur. Nilai 'otomatis' berarti pengukur mengikuti standar
   * yang berlaku menurut umur, sehingga tidak diperlukan koreksi.
   */
  posisiUkur: PosisiUkur
  /** Lingkar lengan atas dalam sentimeter. Opsional, hanya bermakna pada umur 6-59 bulan. */
  lilaCm?: number
  /** Edema bilateral pitting. Penentu gizi buruk yang tidak terlihat pada BB/TB. */
  edema?: boolean
}

export type HasilIndikator = {
  /** Nilai Z. `null` bila indikator tidak dapat dinilai. */
  z: number | null
  /** Tabel dan sumbu yang dipakai, untuk keperluan audit dan pencetakan laporan. */
  keterangan: string
}

export type HasilGizi = {
  /** Berat badan ideal menurut panjang atau tinggi badan, yaitu median tabel BB/PB atau BB/TB. */
  beratIdealKg: number | null
  /** Umur yang mediannya setara panjang/tinggi anak, hasil interpolasi tabel TB/U. */
  usiaTinggiBulan: number | null

  /** Kebutuhan pemeliharaan: RDA menurut umur kronologis dikali berat aktual. */
  rdaPemeliharaanKkalPerKg: number
  kaloriPemeliharaanKkal: number
  proteinPemeliharaanMinGram: number
  proteinPemeliharaanMaksGram: number

  /** Target tumbuh kejar: RDA menurut usia-tinggi dikali berat ideal. */
  rdaCatchUpKkalPerKg: number | null
  kaloriCatchUpKkal: number | null
  proteinCatchUpMinGram: number | null
  proteinCatchUpMaksGram: number | null

  /** Metode yang dianjurkan untuk ditampilkan sebagai target utama. */
  metode: MetodeKalori
}

export type HasilSkrining = {
  engineVersion: string

  umurHari: number
  umurBulan: number

  /** Standar yang berlaku menurut umur: terlentang di bawah 24 bulan, berdiri di atasnya. */
  standarPanjang: StandarPanjang
  panjangTerkoreksiCm: number
  koreksiPosisiCm: number

  bbu: HasilIndikator
  tbu: HasilIndikator
  bbtb: HasilIndikator

  statusBBU: StatusBBU | null
  statusTBU: StatusTBU | null
  statusBBTB: StatusBBTB | null

  /** Menandai kasus yang wajib dirujuk. */
  isRedFlag: boolean
  alasanRedFlag: string[]

  /** `true` bila ada indikator yang tidak dapat dinilai. */
  diLuarRentang: boolean
  alasanDiLuarRentang: AlasanTidakDinilai[]
  catatanDiLuarRentang: string | null

  gizi: HasilGizi
}

export type InputVelocity = {
  tanggalLahir: string
  jenisKelamin: JenisKelamin
  /** Penimbangan sebelumnya. */
  tanggalAwal: string
  beratAwalKg: number
  /** Penimbangan sekarang. */
  tanggalAkhir: string
  beratAkhirKg: number
}

export type HasilVelocity = {
  status: StatusVelocity
  selisihHari: number
  kenaikanAktualGram: number
  /** Ambang persentil 5 WHO yang sudah dikurangi delta dan diskalakan ke selisih hari sebenarnya. */
  kenaikanMinimalGram: number | null
  metode: string
  umurAwalBulan: number
  /** Diisi bila status `tidak_dapat_dinilai`. */
  alasan: string | null
}
