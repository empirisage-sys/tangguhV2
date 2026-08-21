/**
 * Evaluasi kenaikan berat badan (weight velocity / growth faltering).
 *
 * ==========================================================================
 * KOREKSI PALING PENTING DI SELURUH MIGRASI INI
 *
 * WHO memodelkan tabel velocity berat badan pada data yang sudah digeser,
 * yaitu (kenaikan sebenarnya + delta). Nilai yang keluar dari rumus LMS
 * karena itu WAJIB dikurangi delta.
 *
 * Aplikasi versi Firebase tidak melakukan pengurangan itu, sehingga ambang
 * kenaikan minimal terlalu tinggi tepat sebesar delta pada SETIAP penilaian:
 *
 *   interval 1 bulan  ->  400 g terlalu tinggi
 *   interval 2 bulan  ->  600 g terlalu tinggi
 *   interval 3 bulan  ->  650 g (laki-laki) atau 800 g (perempuan)
 *
 * Contoh bayi laki-laki umur 11 bulan, jarak timbang 1 bulan:
 *   Ambang persentil 5 menurut WHO   : -106 g
 *   Ambang yang dipakai aplikasi lama:  294 g
 * Artinya bayi yang kenaikannya masih dalam batas normal menurut WHO akan
 * dinyatakan growth faltering. Arah kesalahannya adalah OVER-DIAGNOSIS.
 *
 * Sudah diverifikasi: rumus di berkas ini menghasilkan kolom persentil 5
 * tabel resmi WHO dengan selisih di bawah 1,5 gram pada 24 titik uji.
 * Lihat TELAAH_KODE_LAMA_TANGGUH.md temuan K-3.
 * ==========================================================================
 *
 * Perubahan kedua: penskalaan linear ambang terhadap jumlah hari sebenarnya
 * dibatasi pada 21-110 hari. Aplikasi lama menskalakan tanpa batas, sehingga
 * jarak timbang 200 hari akan mengalikan ambang tabel 3 bulan sekitar 2,2 kali.
 * Laju pertumbuhan tidak linear terhadap umur, jadi hasilnya tidak sahih.
 */
import { tabelVelocity } from '@/lib/who'
import type { IntervalVelocity, JenisKelamin, TabelVelocity } from '@/lib/who'
import { nilaiDariLms } from './lms'
import { HARI_PER_BULAN, hitungUmur, selisihHari } from './umur'
import type { HasilVelocity, InputVelocity, StatusVelocity } from './tipe'

/** Nilai Z yang setara persentil 5 pada distribusi normal. */
export const Z_PERSENTIL_5 = -1.645

/** Batas jarak antar penimbangan yang masih sahih dinilai, dalam hari. */
export const SELISIH_HARI_MIN = 21
export const SELISIH_HARI_MAKS = 110

/** Memilih tabel interval yang paling dekat dengan jarak timbang sebenarnya. */
export function pilihInterval(selisih: number): IntervalVelocity | null {
  if (selisih < SELISIH_HARI_MIN || selisih > SELISIH_HARI_MAKS) return null
  if (selisih <= 45) return '1bln'
  if (selisih <= 75) return '2bln'
  return '3bln'
}

/**
 * Menghitung ambang persentil 5 kenaikan berat badan dalam gram.
 *
 * Urutan langkahnya penting:
 *   1. hitung nilai dari LMS pada z = -1,645
 *   2. KURANGI delta  <- langkah yang hilang di aplikasi lama
 *   3. skalakan dari jumlah hari standar tabel ke jumlah hari sebenarnya
 */
export function ambangP5Gram(
  tabel: TabelVelocity,
  bulanAwal: number,
  selisih: number,
): number | null {
  const kunci = Math.floor(bulanAwal)
  if (kunci < tabel.bulanAwalMin || kunci > tabel.bulanAwalMaks) return null

  const lms = tabel.baris[kunci]
  if (!lms) return null

  const nilaiTergeser = nilaiDariLms(lms, Z_PERSENTIL_5)
  const p5Sebenarnya = nilaiTergeser - tabel.deltaGram
  const diskalakan = (p5Sebenarnya / tabel.hariStandar) * selisih

  return Math.round(diskalakan)
}

/**
 * Tabel perkiraan kenaikan berat minimal harian, dalam gram per hari.
 *
 * JALUR CADANGAN, BUKAN STANDAR WHO. Diperlukan karena cakupan tabel velocity
 * WHO tidak menjangkau seluruh kebutuhan posyandu:
 *   - interval 1 bulan hanya tersedia untuk umur awal 0-11 bulan
 *   - interval 2 dan 3 bulan hanya tersedia untuk umur awal 0-22 bulan
 * Anak umur 2-5 tahun karena itu tidak dapat dinilai dengan standar velocity WHO.
 *
 * Nilai di bawah dipindahkan apa adanya dari `weightGainData` di constants.ts
 * aplikasi versi Firebase.
 *
 * TODO VERIFIKASI: bandingkan dengan tabel Kenaikan Berat Minimal (KBM) resmi
 * Kemenkes yang dipakai pada Kartu Menuju Sehat. Tabel resmi dinyatakan dalam
 * gram per bulan per umur, bukan gram per hari, sehingga angka di bawah adalah
 * pendekatan. Sampai diverifikasi nutrisionis, hasil dari jalur ini harus
 * ditampilkan dengan keterangan bahwa metodenya perkiraan.
 */
const TABEL_KBM_HARIAN: ReadonlyArray<{ sampaiBulan: number; gramPerHari: number }> = [
  { sampaiBulan: 3, gramPerHari: 30 },
  { sampaiBulan: 6, gramPerHari: 20 },
  { sampaiBulan: 9, gramPerHari: 15 },
  { sampaiBulan: 12, gramPerHari: 12 },
  { sampaiBulan: 36, gramPerHari: 8 },
  { sampaiBulan: 72, gramPerHari: 6 },
]

export function kbmGramPerHari(umurBulan: number): number {
  for (const baris of TABEL_KBM_HARIAN) {
    if (umurBulan <= baris.sampaiBulan) return baris.gramPerHari
  }
  const terakhir = TABEL_KBM_HARIAN[TABEL_KBM_HARIAN.length - 1]
  return terakhir ? terakhir.gramPerHari : 6
}

/**
 * Ambang kenaikan minimal menurut jalur cadangan KBM.
 * Dihitung hari demi hari agar laju yang berubah seiring umur ikut terhitung,
 * sama seperti aplikasi versi Firebase.
 */
export function ambangKbmGram(umurAwalBulan: number, selisih: number): number {
  let total = 0
  for (let i = 0; i < selisih; i += 1) {
    const umurHariItu = umurAwalBulan + i / HARI_PER_BULAN
    total += kbmGramPerHari(umurHariItu)
  }
  return Math.round(total)
}

function tidakDapatDinilai(
  selisih: number,
  kenaikanGram: number,
  umurAwalBulan: number,
  alasan: string,
): HasilVelocity {
  return {
    status: 'tidak_dapat_dinilai',
    selisihHari: selisih,
    kenaikanAktualGram: kenaikanGram,
    kenaikanMinimalGram: null,
    metode: '-',
    umurAwalBulan,
    alasan,
  }
}

export function hitungVelocity(input: InputVelocity): HasilVelocity {
  const { tanggalLahir, jenisKelamin, tanggalAwal, beratAwalKg, tanggalAkhir, beratAkhirKg } = input

  const selisih = selisihHari(tanggalAwal, tanggalAkhir)
  const kenaikanGram = Math.round((beratAkhirKg - beratAwalKg) * 1000)
  const umurAwal = hitungUmur(tanggalLahir, tanggalAwal)

  if (umurAwal.hari < 0) {
    return tidakDapatDinilai(
      selisih,
      kenaikanGram,
      umurAwal.bulan,
      'Tanggal penimbangan sebelumnya mendahului tanggal lahir.',
    )
  }

  if (selisih <= 0) {
    return tidakDapatDinilai(
      selisih,
      kenaikanGram,
      umurAwal.bulan,
      'Tanggal penimbangan sekarang tidak boleh sama atau mendahului penimbangan sebelumnya.',
    )
  }

  const interval = pilihInterval(selisih)
  if (!interval) {
    return tidakDapatDinilai(
      selisih,
      kenaikanGram,
      umurAwal.bulan,
      selisih < SELISIH_HARI_MIN
        ? `Jarak penimbangan hanya ${selisih} hari. Standar WHO tersedia untuk jarak minimal ${SELISIH_HARI_MIN} hari.`
        : `Jarak penimbangan ${selisih} hari melebihi batas ${SELISIH_HARI_MAKS} hari. Lakukan penimbangan baru sebagai titik awal.`,
    )
  }

  const tabel = tabelVelocity(interval, jenisKelamin)
  const ambangWho = ambangP5Gram(tabel, umurAwal.bulan, selisih)

  // Bila tabel WHO tidak mencakup umur anak, beralih ke jalur cadangan KBM.
  const memakaiWho = ambangWho !== null
  const ambang = memakaiWho ? ambangWho : ambangKbmGram(umurAwal.bulan, selisih)

  const metode = memakaiWho
    ? `WHO weight velocity interval ${interval}, persentil 5, delta ${tabel.deltaGram} g dikurangkan`
    : `KBM perkiraan (di luar cakupan tabel velocity WHO ${tabel.bulanAwalMin}-${tabel.bulanAwalMaks} bulan)`

  let status: StatusVelocity
  if (kenaikanGram < ambang) {
    status = kenaikanGram <= 0 ? 'tidak_naik' : 'growth_faltering'
  } else {
    status = 'naik'
  }

  return {
    status,
    selisihHari: selisih,
    kenaikanAktualGram: kenaikanGram,
    kenaikanMinimalGram: ambang,
    metode,
    umurAwalBulan: Math.round(umurAwal.bulan * 100) / 100,
    alasan: null,
  }
}

/** Perkiraan jumlah hari yang setara sejumlah bulan, untuk kebutuhan tampilan. */
export function bulanKeHari(bulan: number): number {
  return Math.round(bulan * HARI_PER_BULAN)
}
