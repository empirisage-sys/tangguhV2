/**
 * Engine perhitungan skrining antropometri Aplikasi TANGGUH.
 *
 * Satu-satunya pintu masuk yang dipakai aplikasi adalah `hitungSkrining`.
 * Fungsi ini murni: tidak memanggil jaringan, tidak menyentuh tanggal sistem,
 * tidak menyimpan keadaan. Masukan sama selalu menghasilkan keluaran sama.
 * Sifat itu yang memungkinkan fungsi ini dipakai di dua tempat sekaligus:
 * di perangkat kader supaya hasil tampil seketika saat offline, dan di server
 * untuk dihitung ulang sebagai sumber kebenaran.
 *
 * Riwayat versi:
 *   zscore-2.0.0  Versi Next.js. Enam perubahan perilaku terhadap versi
 *                 Firebase, semuanya terdokumentasi di
 *                 docs/PERBEDAAN_DENGAN_APLIKASI_LAMA.md
 *   zscore-2.1.0  Perbaikan temuan audit September 2026:
 *                 Z-3 penjagaan panjang badan dan penandaan Z di luar batas
 *                       kemasukakalan biologis WHO
 *                 Z-4 koreksi prematuritas masuk ke mesin, berbatas umur, dan
 *                       terekam pada hasil
 *                 Z-7 `statusTBU` diteruskan ke perhitungan kebutuhan gizi
 *                 Z-18 pita LILA gizi kurang akut sedang dan batas umur 59 bulan
 *                 AGENTS.md 2.3 `kodeRedFlag` untuk penyaringan berbasis kode
 *   zscore-2.2.0  Perbaikan temuan audit K-1:
 *                 target tumbuh kejar tidak lagi hilang tanpa keterangan pada
 *                 anak yang lebih tinggi daripada median TB/U umur 60 bulan
 *                 atau lebih pendek daripada median panjang lahir.
 *
 *                 NOMOR VERSI WAJIB NAIK. Kolom `engine_version` pada tabel
 *                 `skrining` menjadi satu-satunya cara membedakan baris yang
 *                 dihitung sebelum dan sesudah perbaikan ini. Baris berlabel
 *                 zscore-2.1.0 dengan `kalori_metode = 'pemeliharaan'` pada
 *                 anak berstatus gizi buruk patut ditinjau ulang: sebagian
 *                 kemungkinan seharusnya bertarget tumbuh kejar.
 */
import {
  LANGKAH_PANJANG_CM,
  LANGKAH_UMUR_BULAN,
  tabelPanjang,
  tabelUmur,
  UMUR_MAKS_BULAN,
} from '@/lib/who'
import { bulatkanZ, hitungZ, interpolasiLms } from './lms'
import { klasifikasiBBTB, klasifikasiBBU, klasifikasiTBU } from './klasifikasi'
import { hitungKebutuhanGizi } from './gizi'
import { BATAS_UMUR_KOREKSI_PREMATUR_BULAN, HARI_PER_BULAN, hitungUmur, hitungUsiaKoreksi } from './umur'
import type {
  AlasanTidakDinilai,
  HasilIndikator,
  HasilSkrining,
  InputSkrining,
  KodeRedFlag,
  PosisiUkur,
  StandarPanjang,
} from './tipe'

export const ENGINE_VERSION = 'zscore-2.2.0'

/** Umur, dalam bulan, tempat standar berpindah dari panjang terlentang ke tinggi berdiri. */
export const UMUR_PERALIHAN_BULAN = 24

/** Besar koreksi antara pengukuran terlentang dan berdiri, dalam sentimeter. */
export const KOREKSI_POSISI_CM = 0.7

/** Batas kewajaran pengukuran, sejalan dengan batasan `check` di database. */
export const BATAS = {
  beratMinKg: 0.5,
  beratMaksKg: 40,
  panjangMinCm: 30,
  panjangMaksCm: 140,
} as const

/**
 * Batas kemasukakalan biologis nilai Z, mengikuti kriteria penandaan
 * (flagging) WHO Anthro: TB/U -6..+6, BB/U -6..+5, BB/TB -5..+5.
 *
 * ==========================================================================
 * PENTING: NILAI DI LUAR BATAS INI DITANDAI, TIDAK DIBUANG
 *
 * WHO memakai batas ini untuk MEMBERSIHKAN DATA SURVEI populasi. Aplikasi ini
 * bukan survei, melainkan skrining perorangan, dan di sini membuang nilai
 * ekstrem justru berbahaya: anak umur 24 bulan dengan tinggi 87 cm dan berat
 * 8 kg — kasus gizi buruk yang sebenarnya, bukan salah catat — menghasilkan
 * Z BB/TB sekitar -5,8, yaitu di luar batas WHO. Bila nilai itu dibuang,
 * penanda rujukan `bbtb_gizi_buruk` ikut hilang dan anak yang paling perlu
 * dirujuk justru tidak tertandai.
 *
 * Karena itu perilakunya: nilai Z dan status gizi TETAP dikembalikan, tetapi
 * `diLuarRentang` menjadi `true` disertai kode alasan dan catatan yang
 * menyuruh pengukuran diulang. Pemeriksa melihat angkanya sekaligus tahu
 * angka itu perlu dikonfirmasi.
 *
 * Sebelum perbaikan ini tidak ada penjagaan sama sekali pada panjang badan:
 * anak umur 24 bulan dengan masukan 45 cm menghasilkan Z TB/U -13,785 yang
 * disajikan sebagai hasil sahih `diLuarRentang: false` tanpa satu pun
 * peringatan, dan konstanta `BATAS.panjangMinCm` serta `BATAS.panjangMaksCm`
 * tidak pernah dipakai di seluruh basis kode. Lihat temuan audit Z-3.
 * ==========================================================================
 */
export const BATAS_Z_WAJAR = {
  bbu: { min: -6, maks: 5 },
  tbu: { min: -6, maks: 6 },
  bbtb: { min: -5, maks: 5 },
} as const

/** Umur berlakunya penilaian LILA, dalam bulan. */
export const LILA_UMUR_MIN_BULAN = 6
export const LILA_UMUR_MAKS_BULAN = 59

/** Ambang LILA dalam sentimeter, sesuai kriteria WHO untuk umur 6-59 bulan. */
export const LILA_AMBANG_CM = {
  giziBurukAkut: 11.5,
  giziKurangAkut: 12.5,
} as const

/**
 * Menentukan standar yang berlaku dan mengoreksi hasil pengukuran ke standar itu.
 *
 * Standar ditentukan oleh UMUR, bukan oleh posisi pengukuran:
 *   umur < 24 bulan   -> standar panjang badan terlentang
 *   umur >= 24 bulan  -> standar tinggi badan berdiri
 *
 * Bila pengukur memakai posisi yang berbeda dari standar, hasilnya dikoreksi:
 *   diukur berdiri padahal standarnya terlentang  -> tambah 0,7 cm
 *   diukur terlentang padahal standarnya berdiri  -> kurangi 0,7 cm
 *
 * Perilaku ini dipertahankan persis seperti aplikasi versi Firebase, termasuk
 * titik peralihan tepat pada 24 bulan. Titik peralihan itu konsisten dengan
 * peralihan basis pada tabel TB/U WHO, yang pada bulan ke-23 masih memakai
 * basis panjang (median 86,941 cm) dan pada bulan ke-24 sudah memakai basis
 * tinggi (median 87,116 cm).
 */
export function koreksiPosisi(
  panjangCm: number,
  umurBulan: number,
  posisi: PosisiUkur,
): { panjangTerkoreksiCm: number; koreksiCm: number; standar: StandarPanjang } {
  const standar: StandarPanjang =
    umurBulan < UMUR_PERALIHAN_BULAN ? 'terlentang' : 'berdiri'

  let koreksiCm = 0
  if (posisi === 'berdiri' && standar === 'terlentang') {
    koreksiCm = KOREKSI_POSISI_CM
  } else if (posisi === 'terlentang' && standar === 'berdiri') {
    koreksiCm = -KOREKSI_POSISI_CM
  }
  // posisi 'otomatis' berarti pengukur mengikuti standar, jadi tidak ada koreksi.

  return {
    panjangTerkoreksiCm: Math.round((panjangCm + koreksiCm) * 10) / 10,
    koreksiCm,
    standar,
  }
}

const KOSONG: HasilIndikator = { z: null, keterangan: 'Tidak dapat dinilai' }

/**
 * Angka untuk kalimat berbahasa Indonesia: pemisah desimal koma.
 *
 * Sebelumnya catatan di luar rentang memakai titik ("-13.789", "24.0 bulan")
 * sementara seluruh aplikasi memakai koma lewat `formatZ` dan `angka` di
 * `src/lib/tampilan/format.ts`. Ditemukan saat uji produksi.
 */
function angkaId(nilai: number, desimal = 3): string {
  return nilai.toFixed(desimal).replace(/\.?0+$/, '').replace('.', ',') || '0'
}

/** `true` bila nilai Z berada di luar batas kemasukakalan biologis WHO. */
function zTidakMasukAkal(z: number | null, batas: { min: number; maks: number }): boolean {
  if (z === null) return false
  return z < batas.min || z > batas.maks
}

export function hitungSkrining(input: InputSkrining): HasilSkrining {
  // --- Umur: kronologis lalu koreksi prematuritas bila berlaku ---
  //
  // Koreksi dihitung DI DALAM mesin, bukan dengan menyuntikkan tanggal lahir
  // palsu dari lapisan halaman seperti sebelumnya, sehingga hasilnya dapat
  // diaudit kembali: umur kronologis dan besar defisit ikut dikembalikan.
  const umurKronologis = hitungUmur(input.tanggalLahir, input.tanggalPeriksa)
  const koreksi = hitungUsiaKoreksi(
    input.tanggalLahir,
    input.tanggalPeriksa,
    input.usiaGestasiMinggu,
    BATAS_UMUR_KOREKSI_PREMATUR_BULAN,
  )

  const umur = koreksi.isPrematur
    ? {
        hari: umurKronologis.hari - koreksi.defisitHari,
        bulan: (umurKronologis.hari - koreksi.defisitHari) / HARI_PER_BULAN,
      }
    : { hari: umurKronologis.hari, bulan: umurKronologis.bulan }

  const { panjangTerkoreksiCm, koreksiCm, standar } = koreksiPosisi(
    input.panjangCm,
    umur.bulan,
    input.posisiUkur,
  )

  const alasan: AlasanTidakDinilai[] = []
  const catatan: string[] = []

  // --- Penjagaan batas sebelum menghitung apa pun ---
  if (umur.hari < 0) {
    alasan.push('umur_negatif')
    catatan.push('Tanggal periksa mendahului tanggal lahir.')
  }

  if (umur.bulan > UMUR_MAKS_BULAN) {
    alasan.push('umur_melebihi_60_bulan')
    catatan.push(
      `Umur ${angkaId(umur.bulan, 1)} bulan berada di luar cakupan standar WHO 0-60 bulan ` +
        'yang dipakai aplikasi ini. Untuk anak di atas 5 tahun berlaku rujukan WHO 5-19 tahun ' +
        'yang belum tersedia di aplikasi.',
    )
  }

  if (input.beratKg < BATAS.beratMinKg || input.beratKg > BATAS.beratMaksKg) {
    alasan.push('berat_di_luar_batas_wajar')
    catatan.push(
      `Berat ${angkaId(input.beratKg, 2)} kg di luar batas wajar ${angkaId(BATAS.beratMinKg, 1)}-${angkaId(BATAS.beratMaksKg, 1)} kg. ` +
        'Periksa kembali angka penimbangan.',
    )
  }

  // Penjagaan panjang badan. Konstanta BATAS.panjang* akhirnya dipakai (Z-3).
  if (
    !Number.isFinite(input.panjangCm) ||
    input.panjangCm < BATAS.panjangMinCm ||
    input.panjangCm > BATAS.panjangMaksCm
  ) {
    alasan.push('panjang_di_luar_batas_wajar')
    catatan.push(
      `Panjang atau tinggi ${angkaId(input.panjangCm, 1)} cm di luar batas wajar ` +
        `${BATAS.panjangMinCm}-${BATAS.panjangMaksCm} cm. Periksa kembali angka di alat ukur.`,
    )
  }

  const umurValid = umur.hari >= 0 && umur.bulan <= UMUR_MAKS_BULAN
  const beratValid =
    input.beratKg >= BATAS.beratMinKg && input.beratKg <= BATAS.beratMaksKg
  const panjangValid =
    Number.isFinite(input.panjangCm) &&
    input.panjangCm >= BATAS.panjangMinCm &&
    input.panjangCm <= BATAS.panjangMaksCm

  // --- BB/U ---
  let bbu: HasilIndikator = KOSONG
  if (umurValid && beratValid) {
    const { lms, diLuarRentang } = interpolasiLms(
      umur.bulan,
      tabelUmur('bbu', input.jenisKelamin),
      LANGKAH_UMUR_BULAN,
    )
    if (!diLuarRentang) {
      const z = bulatkanZ(hitungZ(input.beratKg, lms))
      bbu = { z, keterangan: `BB/U pada umur ${angkaId(umur.bulan, 2)} bulan` }
      if (zTidakMasukAkal(z, BATAS_Z_WAJAR.bbu)) {
        alasan.push('berat_tidak_wajar_untuk_umur')
        catatan.push(
          `Z BB/U ${angkaId(z!)} berada di luar batas kemasukakalan biologis WHO ` +
            `(${angkaId(BATAS_Z_WAJAR.bbu.min)} sampai ${angkaId(BATAS_Z_WAJAR.bbu.maks)} SD). ` +
            'Nilainya tetap ditampilkan, tetapi berat badan dan tanggal lahir wajib ' +
            'diperiksa ulang sebelum hasil ini dipakai.',
        )
      }
    }
  }

  // --- TB/U ---
  let tbu: HasilIndikator = KOSONG
  if (umurValid && panjangValid) {
    const { lms, diLuarRentang } = interpolasiLms(
      umur.bulan,
      tabelUmur('tbu', input.jenisKelamin),
      LANGKAH_UMUR_BULAN,
    )
    if (!diLuarRentang) {
      const label = standar === 'terlentang' ? 'PB/U' : 'TB/U'
      const z = bulatkanZ(hitungZ(panjangTerkoreksiCm, lms))
      tbu = {
        z,
        keterangan: `${label} pada umur ${angkaId(umur.bulan, 2)} bulan, ` +
          `panjang terkoreksi ${angkaId(panjangTerkoreksiCm, 1)} cm`,
      }
      if (zTidakMasukAkal(z, BATAS_Z_WAJAR.tbu)) {
        alasan.push('panjang_tidak_wajar_untuk_umur')
        catatan.push(
          `Z ${label} ${angkaId(z!)} berada di luar batas kemasukakalan biologis WHO ` +
            `(${angkaId(BATAS_Z_WAJAR.tbu.min)} sampai ${angkaId(BATAS_Z_WAJAR.tbu.maks)} SD): panjang ` +
            `${angkaId(panjangTerkoreksiCm, 1)} cm tidak wajar pada umur ${angkaId(umur.bulan, 1)} bulan. ` +
            'Nilainya tetap ditampilkan, tetapi WAJIB diukur ulang sebelum dipakai. ' +
            'Salah ketik satu angka pada alat ukur menghasilkan pola seperti ini.',
        )
      }
    }
  }

  // --- BB/PB atau BB/TB ---
  //
  // Tabel dipilih menurut standar umur. Peralihan tambahan hanya berfungsi
  // sebagai pengaman ketika nilai terkoreksi melampaui rentang tabel yang
  // seharusnya dipakai: BB/PB mencakup 45-110 cm, BB/TB mencakup 65-120 cm.
  let bbtb: HasilIndikator = KOSONG
  let beratIdealKg: number | null = null

  // Umur juga menjadi syarat, meskipun tabel BB/PB dan BB/TB tidak berbasis umur.
  // Alasannya konsistensi: standar antropometri yang dipakai aplikasi ini berlaku
  // untuk 0-60 bulan. Menolak TB/U pada umur 62 bulan tetapi tetap menyajikan
  // BB/TB akan menghasilkan laporan yang setengah sahih, dan itu lebih
  // membingungkan daripada menolak seluruhnya.
  if (beratValid && umurValid && panjangValid) {
    let indikator: 'bbpb' | 'bbtb' = standar === 'terlentang' ? 'bbpb' : 'bbtb'
    if (indikator === 'bbpb' && panjangTerkoreksiCm > 110) indikator = 'bbtb'
    if (indikator === 'bbtb' && panjangTerkoreksiCm < 65) indikator = 'bbpb'

    const tabel = tabelPanjang(indikator, input.jenisKelamin)
    const { lms, diLuarRentang } = interpolasiLms(
      panjangTerkoreksiCm,
      tabel,
      LANGKAH_PANJANG_CM,
    )

    if (diLuarRentang || !lms) {
      alasan.push('panjang_di_luar_tabel')
      catatan.push(
        `Panjang atau tinggi terkoreksi ${angkaId(panjangTerkoreksiCm, 1)} cm berada di luar rentang ` +
          `tabel ${indikator === 'bbpb' ? 'BB/PB (45-110 cm)' : 'BB/TB (65-120 cm)'}. ` +
          'Indikator BB/PB atau BB/TB tidak dapat dinilai.',
      )
    } else {
      const z = bulatkanZ(hitungZ(input.beratKg, lms))
      beratIdealKg = Math.round(lms[1] * 100) / 100
      bbtb = {
        z,
        keterangan:
          `${indikator === 'bbpb' ? 'BB/PB' : 'BB/TB'} pada ${angkaId(panjangTerkoreksiCm, 1)} cm`,
      }
      if (zTidakMasukAkal(z, BATAS_Z_WAJAR.bbtb)) {
        alasan.push('berat_tidak_wajar_untuk_panjang')
        catatan.push(
          `Z ${indikator === 'bbpb' ? 'BB/PB' : 'BB/TB'} ${angkaId(z!)} berada di luar batas ` +
            `kemasukakalan biologis WHO (${angkaId(BATAS_Z_WAJAR.bbtb.min)} sampai ` +
            `${angkaId(BATAS_Z_WAJAR.bbtb.maks)} SD). Nilainya tetap ditampilkan dan penanda ` +
            'rujukan tetap berlaku, tetapi berat dan panjang wajib diperiksa ulang.',
        )
      }
    }
  }

  const statusBBU = klasifikasiBBU(bbu.z)
  const statusTBU = klasifikasiTBU(tbu.z)
  const statusBBTB = klasifikasiBBTB(bbtb.z)

  // --- Red flag: kasus yang wajib dirujuk ---
  //
  // Dikembalikan sebagai KODE terlebih dahulu. Penyaringan dan pengambilan
  // keputusan wajib memakai `kodeRedFlag`, tidak pernah mencocokkan teks
  // (AGENTS.md 2.3). Kalimat pada `alasanRedFlag` hanya untuk ditampilkan.
  const kodeRedFlag: KodeRedFlag[] = []
  const alasanRedFlag: string[] = []

  if (statusTBU === 'sangat_pendek') {
    kodeRedFlag.push('tbu_sangat_pendek')
    alasanRedFlag.push('Sangat pendek (TB/U di bawah -3 SD)')
  }
  if (statusBBTB === 'gizi_buruk') {
    kodeRedFlag.push('bbtb_gizi_buruk')
    alasanRedFlag.push('Gizi buruk (BB/TB di bawah -3 SD)')
  }
  if (statusBBU === 'berat_badan_sangat_kurang') {
    kodeRedFlag.push('bbu_sangat_kurang')
    alasanRedFlag.push('Berat badan sangat kurang (BB/U di bawah -3 SD)')
  }
  if (input.edema === true) {
    kodeRedFlag.push('edema_bilateral')
    alasanRedFlag.push('Edema bilateral, penanda gizi buruk yang tidak terlihat pada BB/TB')
  }

  // LILA hanya bermakna pada umur 6-59 bulan. Versi sebelumnya tidak memiliki
  // batas atas umur dan hanya mengenal satu ambang (Z-18).
  if (
    input.lilaCm !== undefined &&
    Number.isFinite(input.lilaCm) &&
    umur.bulan >= LILA_UMUR_MIN_BULAN &&
    umur.bulan <= LILA_UMUR_MAKS_BULAN
  ) {
    if (input.lilaCm < LILA_AMBANG_CM.giziBurukAkut) {
      kodeRedFlag.push('lila_gizi_buruk_akut')
      alasanRedFlag.push(
        `LILA ${input.lilaCm} cm di bawah ${LILA_AMBANG_CM.giziBurukAkut} cm (gizi buruk akut)`,
      )
    } else if (input.lilaCm < LILA_AMBANG_CM.giziKurangAkut) {
      kodeRedFlag.push('lila_gizi_kurang_akut')
      alasanRedFlag.push(
        `LILA ${input.lilaCm} cm berada pada ${LILA_AMBANG_CM.giziBurukAkut}-` +
          `${LILA_AMBANG_CM.giziKurangAkut} cm (gizi kurang akut sedang)`,
      )
    }
  }

  if (koreksi.koreksiKedaluwarsa) {
    catatan.push(
      `Anak lahir prematur pada usia gestasi ${koreksi.usiaGestasiMinggu} minggu, tetapi ` +
        `umurnya sudah melewati ${BATAS_UMUR_KOREKSI_PREMATUR_BULAN} bulan sehingga koreksi ` +
        'prematuritas tidak lagi diterapkan. Seluruh indikator memakai umur kronologis.',
    )
  }

  const gizi = hitungKebutuhanGizi({
    umurBulan: umur.bulan,
    beratKg: input.beratKg,
    beratIdealKg,
    panjangTerkoreksiCm,
    jenisKelamin: input.jenisKelamin,
    statusBBTB,
    statusTBU,
  })

  // --- Keterbukaan perhitungan tumbuh kejar (temuan audit K-1) ---
  //
  // Dahulu kedua keadaan di bawah tidak menghasilkan apa pun di layar: target
  // tumbuh kejar sekadar hilang dan metode jatuh ke pemeliharaan, pada anak
  // yang justru berstatus gizi buruk.
  if (gizi.posisiUsiaTinggi !== 'dalam_tabel' && gizi.kaloriCatchUpKkal !== null) {
    catatan.push(
      gizi.posisiUsiaTinggi === 'di_atas_median_60_bulan'
        ? `Tinggi ${angkaId(panjangTerkoreksiCm, 1)} cm melebihi median TB/U umur 60 bulan, ` +
            'sehingga usia-tinggi tidak dapat ditentukan. Target tumbuh kejar tetap dihitung ' +
            `memakai RDA ${gizi.rdaCatchUpKkalPerKg} kkal/kg, yang berlaku sama untuk seluruh ` +
            'usia-tinggi di atas 36 bulan.'
        : `Panjang ${angkaId(panjangTerkoreksiCm, 1)} cm lebih pendek dari median panjang lahir, ` +
            'sehingga usia-tinggi tidak dapat ditentukan. Target tumbuh kejar tetap dihitung ' +
            `memakai RDA ${gizi.rdaCatchUpKkalPerKg} kkal/kg, yang berlaku sama untuk seluruh ` +
            'usia-tinggi di bawah 12 bulan.',
    )
  }

  if (gizi.alasanCatchUpKosong !== null) {
    catatan.push(
      gizi.alasanCatchUpKosong === 'berat_ideal_tidak_ada'
        ? 'Status gizi anak ini membutuhkan target tumbuh kejar, tetapi berat badan ideal ' +
            'tidak dapat dihitung karena panjang atau tinggi berada di luar tabel BB/PB dan ' +
            'BB/TB. Angka yang ditampilkan adalah kebutuhan PEMELIHARAAN, bukan tumbuh kejar. ' +
            'Tentukan targetnya secara manual bersama dietisien.'
        : 'Status gizi anak ini membutuhkan target tumbuh kejar, tetapi RDA usia-tinggi tidak ' +
            'dapat ditetapkan. Angka yang ditampilkan adalah kebutuhan PEMELIHARAAN, bukan ' +
            'tumbuh kejar. Tentukan targetnya secara manual bersama dietisien.',
    )
  }

  return {
    engineVersion: ENGINE_VERSION,
    umurHari: umur.hari,
    umurBulan: Math.round(umur.bulan * 100) / 100,
    umurDikoreksiPrematur: koreksi.isPrematur,
    umurKronologisHari: umurKronologis.hari,
    umurKronologisBulan: Math.round(umurKronologis.bulan * 100) / 100,
    defisitPrematurHari: koreksi.isPrematur ? koreksi.defisitHari : 0,
    koreksiPrematurKedaluwarsa: koreksi.koreksiKedaluwarsa,
    standarPanjang: standar,
    panjangTerkoreksiCm,
    koreksiPosisiCm: koreksiCm,
    bbu,
    tbu,
    bbtb,
    statusBBU,
    statusTBU,
    statusBBTB,
    isRedFlag: kodeRedFlag.length > 0,
    kodeRedFlag,
    alasanRedFlag,
    diLuarRentang: alasan.length > 0,
    alasanDiLuarRentang: alasan,
    catatanDiLuarRentang: catatan.length > 0 ? catatan.join(' ') : null,
    gizi,
  }
}

export * from './tipe'
export * from './klasifikasi'
export * from './velocity'
export {
  hitungUmur,
  hitungUmurKalender,
  hitungUsiaKoreksi,
  selisihHari,
  HARI_PER_BULAN,
  BATAS_UMUR_KOREKSI_PREMATUR_BULAN,
  GESTASI_CUKUP_BULAN_MINGGU,
  GESTASI_MIN_MINGGU,
  GESTASI_MAKS_MINGGU,
  type UmurKalender,
  type UsiaKoreksiPrematur,
} from './umur'
export { hitungZ, nilaiDariLms, interpolasiLms, lmsUntukKurva } from './lms'
export {
  hitungKebutuhanGizi,
  usiaTinggiBulan,
  cariUsiaTinggi,
  rdaKkalPerKg,
  rdaCatchUpKkalPerKg,
  type HasilUsiaTinggi,
  type PosisiUsiaTinggi,
} from './gizi'
export { apakahPerluPKMK, type InputIndikasiPKMK } from './indikasi-pkmk'
