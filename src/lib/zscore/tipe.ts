import type { JenisKelamin, IntervalVelocity } from '@/lib/who'

export type { JenisKelamin, IntervalVelocity }

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

/**
 * Status kenaikan berat badan.
 *
 * `turun_masih_dalam_batas` ada karena ambang persentil 5 WHO dapat bernilai
 * NEGATIF pada 33 kombinasi umur, interval, dan jenis kelamin (mis. laki-laki
 * umur awal 11 bulan, interval 1 bulan: -106 g). Tanpa status ini, anak yang
 * beratnya turun 50 g tetapi masih di atas ambang negatif akan dilabeli 'naik',
 * yaitu pernyataan yang tidak benar. Lihat temuan audit Z-1.
 */
export type StatusVelocity =
  | 'naik'
  | 'turun_masih_dalam_batas'
  | 'tidak_naik'
  | 'growth_faltering'
  | 'tidak_dapat_dinilai'

/**
 * Metode yang dipakai menghitung ambang kenaikan minimal.
 * Kode, bukan teks. Kalimatnya disusun di lapisan tampilan (AGENTS.md 2.4).
 */
export type KodeMetodeVelocity = 'who_velocity' | 'kbm_perkiraan' | 'tidak_ada'

export type MetodeKalori = 'pemeliharaan' | 'catch_up'

/** Kode alasan rujukan. Dipakai untuk menyaring; kalimatnya disusun di tampilan. */
export type KodeRedFlag =
  | 'tbu_sangat_pendek'
  | 'bbtb_gizi_buruk'
  | 'bbu_sangat_kurang'
  | 'edema_bilateral'
  /** LILA < 11,5 cm pada umur 6-59 bulan: gizi buruk akut. */
  | 'lila_gizi_buruk_akut'
  /** LILA 11,5-12,4 cm pada umur 6-59 bulan: gizi kurang akut sedang. */
  | 'lila_gizi_kurang_akut'

/** Alasan sebuah indikator tidak dapat dinilai. */
export type AlasanTidakDinilai =
  | 'umur_melebihi_60_bulan'
  | 'umur_negatif'
  | 'panjang_di_luar_tabel'
  | 'berat_di_luar_batas_wajar'
  /** Panjang di luar 30-140 cm. Sebelumnya BATAS.panjang* tidak pernah dipakai (Z-3). */
  | 'panjang_di_luar_batas_wajar'
  /**
   * Nilai Z di luar batas kemasukakalan biologis WHO. Menangkap salah ketik
   * yang lolos batas absolut, misalnya panjang 45 cm pada anak umur 24 bulan
   * yang menghasilkan Z TB/U -13,8 namun sebelumnya disajikan sebagai sahih.
   * Lihat temuan audit Z-3 dan `BATAS_Z_WAJAR`.
   */
  | 'berat_tidak_wajar_untuk_umur'
  | 'panjang_tidak_wajar_untuk_umur'
  | 'berat_tidak_wajar_untuk_panjang'
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
  /**
   * Usia gestasi saat lahir dalam minggu. Bila diisi dan di bawah 37 minggu,
   * umur yang dipakai untuk SELURUH indikator adalah umur koreksi.
   *
   * Sebelumnya koreksi prematuritas hanya ada di halaman skrining tamu dan
   * dikerjakan dengan menyuntikkan tanggal lahir palsu, sehingga hasilnya tidak
   * dapat dibedakan dari umur kronologis saat tersimpan. Lihat temuan Z-4.
   */
  usiaGestasiMinggu?: number
}

export type HasilIndikator = {
  /** Nilai Z. `null` bila indikator tidak dapat dinilai. */
  z: number | null
  /** Tabel dan sumbu yang dipakai, untuk keperluan audit dan pencetakan laporan. */
  keterangan: string
}

/**
 * Mengapa target tumbuh kejar kosong padahal status gizi membutuhkannya.
 * `null` berarti tidak ada masalah: entah tumbuh kejar terhitung, entah
 * memang tidak dibutuhkan. Lihat temuan audit K-1.
 */
export type AlasanCatchUpKosong =
  /** Panjang atau tinggi di luar tabel BB/PB dan BB/TB, sehingga berat ideal tak ada. */
  | 'berat_ideal_tidak_ada'
  /** Tabel RDA tidak lagi seragam pada wilayah di luar tabel usia-tinggi. */
  | 'rda_tidak_tentu'
  | null

export type HasilGizi = {
  /** Berat badan ideal menurut panjang atau tinggi badan, yaitu median tabel BB/PB atau BB/TB. */
  beratIdealKg: number | null
  /** Umur yang mediannya setara panjang/tinggi anak, hasil interpolasi tabel TB/U. */
  usiaTinggiBulan: number | null
  /**
   * Posisi anak terhadap rentang median TB/U. Bernilai bukan 'dalam_tabel'
   * berarti `usiaTinggiBulan` null KARENA di luar rentang, bukan karena galat —
   * dan RDA tumbuh kejar tetap tertentu. Lihat temuan audit K-1.
   */
  posisiUsiaTinggi: 'dalam_tabel' | 'di_bawah_median_lahir' | 'di_atas_median_60_bulan'
  /** Terisi hanya bila tumbuh kejar dibutuhkan tetapi tidak dapat dihitung. */
  alasanCatchUpKosong: AlasanCatchUpKosong

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

  /** Umur yang DIPAKAI untuk menilai indikator. Sama dengan umur koreksi bila prematur. */
  umurHari: number
  umurBulan: number

  /**
   * Jejak koreksi prematuritas. WAJIB disimpan bersama hasil: tanpa ini,
   * baris skrining tidak dapat diaudit kembali karena umur terkoreksi dan umur
   * kronologis tampak sama.
   */
  umurDikoreksiPrematur: boolean
  umurKronologisHari: number
  umurKronologisBulan: number
  defisitPrematurHari: number
  /** `true` bila usia gestasi diisi tetapi koreksi TIDAK diterapkan karena melewati batas umur. */
  koreksiPrematurKedaluwarsa: boolean

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
  /**
   * Kode alasan rujukan. Pakai INI untuk menyaring dan mengambil keputusan.
   * `alasanRedFlag` di bawahnya hanya untuk ditampilkan (AGENTS.md 2.3 & 2.4).
   */
  kodeRedFlag: KodeRedFlag[]
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

/** Alasan sebuah penilaian velocity tidak dapat dilakukan. Kode, bukan teks. */
export type AlasanTidakDinilaiVelocity =
  | 'umur_negatif'
  | 'urutan_tanggal_salah'
  | 'jarak_terlalu_rapat'
  | 'jarak_terlalu_jauh'

export type HasilVelocity = {
  status: StatusVelocity
  selisihHari: number
  kenaikanAktualGram: number
  /** Ambang persentil 5 WHO yang sudah dikurangi delta dan diskalakan ke selisih hari sebenarnya. */
  kenaikanMinimalGram: number | null
  /**
   * Kode metode. Sebelumnya medan ini berisi kalimat siap-tampil yang disusun
   * di lapisan logika, melanggar AGENTS.md 2.4. Lihat temuan Z-11.
   */
  metode: KodeMetodeVelocity
  /** Angka pendukung untuk menyusun kalimat di lapisan tampilan. */
  metodeAngka: {
    interval: IntervalVelocity | null
    deltaGram: number | null
    cakupanBulanMin: number | null
    cakupanBulanMaks: number | null
  }
  /** `true` bila ambang WHO pada umur ini bernilai negatif, yaitu kehilangan berat ringan masih dalam batas. */
  ambangNegatif: boolean
  umurAwalBulan: number
  /** Diisi bila status `tidak_dapat_dinilai`. Kode, bukan teks. */
  alasan: AlasanTidakDinilaiVelocity | null
  /** Angka pendukung alasan, untuk menyusun kalimat di lapisan tampilan. */
  alasanAngka: Record<string, number>
}
