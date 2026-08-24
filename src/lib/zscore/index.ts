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
import { hitungUmur } from './umur'
import type {
  AlasanTidakDinilai,
  HasilIndikator,
  HasilSkrining,
  InputSkrining,
  PosisiUkur,
  StandarPanjang,
} from './tipe'

export const ENGINE_VERSION = 'zscore-2.0.0'

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

export function hitungSkrining(input: InputSkrining): HasilSkrining {
  const umur = hitungUmur(input.tanggalLahir, input.tanggalPeriksa)
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
      `Umur ${umur.bulan.toFixed(1)} bulan berada di luar cakupan standar WHO 0-60 bulan ` +
        'yang dipakai aplikasi ini. Untuk anak di atas 5 tahun berlaku rujukan WHO 5-19 tahun ' +
        'yang belum tersedia di aplikasi.',
    )
  }

  if (input.beratKg < BATAS.beratMinKg || input.beratKg > BATAS.beratMaksKg) {
    alasan.push('berat_di_luar_batas_wajar')
    catatan.push(
      `Berat ${input.beratKg} kg di luar batas wajar ${BATAS.beratMinKg}-${BATAS.beratMaksKg} kg. ` +
        'Periksa kembali angka penimbangan.',
    )
  }

  const umurValid = umur.hari >= 0 && umur.bulan <= UMUR_MAKS_BULAN
  const beratValid =
    input.beratKg >= BATAS.beratMinKg && input.beratKg <= BATAS.beratMaksKg

  // --- BB/U ---
  let bbu: HasilIndikator = KOSONG
  if (umurValid && beratValid) {
    const { lms, diLuarRentang } = interpolasiLms(
      umur.bulan,
      tabelUmur('bbu', input.jenisKelamin),
      LANGKAH_UMUR_BULAN,
    )
    if (!diLuarRentang) {
      bbu = {
        z: bulatkanZ(hitungZ(input.beratKg, lms)),
        keterangan: `BB/U pada umur ${umur.bulan.toFixed(2)} bulan`,
      }
    }
  }

  // --- TB/U ---
  let tbu: HasilIndikator = KOSONG
  if (umurValid) {
    const { lms, diLuarRentang } = interpolasiLms(
      umur.bulan,
      tabelUmur('tbu', input.jenisKelamin),
      LANGKAH_UMUR_BULAN,
    )
    if (!diLuarRentang) {
      const label = standar === 'terlentang' ? 'PB/U' : 'TB/U'
      tbu = {
        z: bulatkanZ(hitungZ(panjangTerkoreksiCm, lms)),
        keterangan: `${label} pada umur ${umur.bulan.toFixed(2)} bulan, ` +
          `panjang terkoreksi ${panjangTerkoreksiCm} cm`,
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
  if (beratValid && umurValid) {
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
        `Panjang atau tinggi terkoreksi ${panjangTerkoreksiCm} cm berada di luar rentang ` +
          `tabel ${indikator === 'bbpb' ? 'BB/PB (45-110 cm)' : 'BB/TB (65-120 cm)'}. ` +
          'Indikator BB/PB atau BB/TB tidak dapat dinilai.',
      )
    } else {
      beratIdealKg = Math.round(lms[1] * 100) / 100
      bbtb = {
        z: bulatkanZ(hitungZ(input.beratKg, lms)),
        keterangan:
          `${indikator === 'bbpb' ? 'BB/PB' : 'BB/TB'} pada ${panjangTerkoreksiCm} cm`,
      }
    }
  }

  const statusBBU = klasifikasiBBU(bbu.z)
  const statusTBU = klasifikasiTBU(tbu.z)
  const statusBBTB = klasifikasiBBTB(bbtb.z)

  // --- Red flag: kasus yang wajib dirujuk ---
  const alasanRedFlag: string[] = []
  if (statusTBU === 'sangat_pendek') {
    alasanRedFlag.push('Sangat pendek (TB/U di bawah -3 SD)')
  }
  if (statusBBTB === 'gizi_buruk') {
    alasanRedFlag.push('Gizi buruk (BB/TB di bawah -3 SD)')
  }
  if (statusBBU === 'berat_badan_sangat_kurang') {
    alasanRedFlag.push('Berat badan sangat kurang (BB/U di bawah -3 SD)')
  }
  if (input.edema === true) {
    alasanRedFlag.push('Edema bilateral, penanda gizi buruk yang tidak terlihat pada BB/TB')
  }
  if (input.lilaCm !== undefined && umur.bulan >= 6 && input.lilaCm < 11.5) {
    alasanRedFlag.push(`LILA ${input.lilaCm} cm di bawah 11,5 cm`)
  }

  const gizi = hitungKebutuhanGizi({
    umurBulan: umur.bulan,
    beratKg: input.beratKg,
    beratIdealKg,
    panjangTerkoreksiCm,
    jenisKelamin: input.jenisKelamin,
    statusBBTB,
  })

  return {
    engineVersion: ENGINE_VERSION,
    umurHari: umur.hari,
    umurBulan: Math.round(umur.bulan * 100) / 100,
    standarPanjang: standar,
    panjangTerkoreksiCm,
    koreksiPosisiCm: koreksiCm,
    bbu,
    tbu,
    bbtb,
    statusBBU,
    statusTBU,
    statusBBTB,
    isRedFlag: alasanRedFlag.length > 0,
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
export { hitungUmur, hitungUmurKalender, hitungUsiaKoreksi, selisihHari, HARI_PER_BULAN, type UmurKalender, type UsiaKoreksiPrematur } from './umur'
export { hitungZ, nilaiDariLms, interpolasiLms, lmsUntukKurva } from './lms'
export { hitungKebutuhanGizi, usiaTinggiBulan, rdaKkalPerKg } from './gizi'
export { apakahPerluPKMK, type InputIndikasiPKMK } from './indikasi-pkmk'
