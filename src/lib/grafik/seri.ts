/**
 * Penyusun seri data kurva pertumbuhan WHO.
 *
 * Berkas ini murni: tidak ada React, tidak ada Recharts, tidak ada SVG. Ia
 * hanya mengubah tabel LMS dan riwayat skrining seorang anak menjadi deretan
 * titik yang siap digambar. Karena murni, seluruhnya dapat diuji.
 *
 * Tiga kurva yang dihasilkan mengikuti bentuk resmi WHO Child Growth Standards:
 *
 *   BB/U    berat badan menurut umur (Laki-laki & Perempuan)
 *   TB/U    panjang atau tinggi badan menurut umur (Laki-laki & Perempuan)
 *   BB/TB   berat badan menurut panjang atau tinggi badan (Laki-laki & Perempuan)
 *
 * Ditambah satu kurva tren nilai Z ketiga indikator dalam satu bidang.
 */
import {
  LANGKAH_PANJANG_CM,
  LANGKAH_UMUR_BULAN,
  tabelPanjang,
  tabelUmur,
  UMUR_MAKS_BULAN,
  type IndikatorPanjang,
  type IndikatorUmur,
  type JenisKelamin,
  type TabelLms,
} from '@/lib/who'
import { lmsUntukKurva, nilaiDariLms } from '@/lib/zscore/lms'
import type { StandarPanjang } from '@/lib/zscore/tipe'

/** Garis rujukan yang digambar. */
export const GARIS_SD = [-3, -2, 0, 2, 3] as const
export type GarisSd = (typeof GARIS_SD)[number]

export type TitikRujukan = {
  x: number
  /** Nilai pengukuran pada tiap garis SD. Kunci berupa teks agar aman di Recharts. */
  sd_n3: number
  sd_n2: number
  sd_n1: number
  sd_0: number
  sd_p1: number
  sd_p2: number
  sd_p3: number
}

/** Satu titik riwayat anak pada kurva. */
export type TitikAnak = {
  x: number
  y: number
  /** Tanggal periksa, untuk keterangan saat titik disentuh. */
  tanggal: string
  z: number | null
  /**
   * Standar yang berlaku saat pengukuran itu dilakukan. Diperlukan pada kurva
   * BB/TB, karena anak yang riwayatnya melewati umur 24 bulan memiliki titik
   * dari dua standar yang berbeda.
   */
  standar: StandarPanjang
  /** true bila indikator ini tidak dapat dinilai pada kunjungan tersebut. */
  tidakDinilai: boolean
}

export type SeriKurva = {
  indikator: 'bbu' | 'tbu' | 'bbtb'
  judul: string
  labelX: string
  labelY: string
  rujukan: TitikRujukan[]
  anak: TitikAnak[]
  domainX: [number, number]
  domainY: [number, number]
  seks: JenisKelamin
  /**
   * Catatan yang WAJIB ditampilkan bersama kurva bila ada. Isinya menjelaskan
   * hal yang bisa disalahpahami, misalnya titik yang berasal dari standar lain.
   */
  catatan: string[]
}

/** Satu kunjungan dalam riwayat anak, seperti yang dibaca dari tabel `skrining`. */
export type KunjunganRiwayat = {
  tanggalPeriksa: string
  umurBulan: number
  beratKg: number
  panjangTerkoreksiCm: number
  standarPanjang: StandarPanjang
  zBbu: number | null
  zTbu: number | null
  zBbtb: number | null
}

// ---------------------------------------------------------------------------
// Pembantu
// ---------------------------------------------------------------------------

function titikRujukan(x: number, tabel: TabelLms, langkah: number): TitikRujukan | null {
  const lms = lmsUntukKurva(x, tabel, langkah)
  if (!lms) return null
  return {
    x: Math.round(x * 100) / 100,
    sd_n3: Math.round(nilaiDariLms(lms, -3) * 100) / 100,
    sd_n2: Math.round(nilaiDariLms(lms, -2) * 100) / 100,
    sd_n1: Math.round(nilaiDariLms(lms, -1) * 100) / 100,
    sd_0: Math.round(nilaiDariLms(lms, 0) * 100) / 100,
    sd_p1: Math.round(nilaiDariLms(lms, 1) * 100) / 100,
    sd_p2: Math.round(nilaiDariLms(lms, 2) * 100) / 100,
    sd_p3: Math.round(nilaiDariLms(lms, 3) * 100) / 100,
  }
}

function bangunRujukan(
  tabel: TabelLms,
  langkahTabel: number,
  dari: number,
  sampai: number,
  langkahGambar: number,
): TitikRujukan[] {
  const hasil: TitikRujukan[] = []
  for (let x = dari; x <= sampai + 1e-9; x += langkahGambar) {
    const t = titikRujukan(Math.round(x * 100) / 100, tabel, langkahTabel)
    if (t) hasil.push(t)
  }
  return hasil
}

function domainDari(rujukan: TitikRujukan[], anak: TitikAnak[]): [number, number] {
  let bawah = Number.POSITIVE_INFINITY
  let atas = Number.NEGATIVE_INFINITY

  for (const t of rujukan) {
    bawah = Math.min(bawah, t.sd_n3)
    atas = Math.max(atas, t.sd_p3)
  }
  for (const t of anak) {
    bawah = Math.min(bawah, t.y)
    atas = Math.max(atas, t.y)
  }
  if (!Number.isFinite(bawah) || !Number.isFinite(atas)) return [0, 1]

  const bantalan = Math.max((atas - bawah) * 0.06, 0.3)
  return [Math.max(0, Math.floor(bawah - bantalan)), Math.ceil(atas + bantalan)]
}

/**
 * Menentukan jendela umur yang ditampilkan.
 */
export function jendelaUmur(riwayat: KunjunganRiwayat[]): [number, number] {
  if (riwayat.length === 0) return [0, 12]

  const umur = riwayat.map((r) => r.umurBulan)
  const min = Math.min(...umur)
  const maks = Math.max(...umur)

  let dari = Math.max(0, Math.floor(min - 2))
  let sampai = Math.min(UMUR_MAKS_BULAN, Math.ceil(maks + 4))

  const LEBAR_MIN = 6
  if (sampai - dari < LEBAR_MIN) {
    const kurang = LEBAR_MIN - (sampai - dari)
    sampai = Math.min(UMUR_MAKS_BULAN, sampai + kurang)
    dari = Math.max(0, sampai - LEBAR_MIN)
  }

  return [dari, sampai]
}

/** Jendela panjang atau tinggi badan. */
export function jendelaPanjang(
  riwayat: KunjunganRiwayat[],
  basis: IndikatorPanjang,
): [number, number] {
  const batasTabel: [number, number] = basis === 'bbpb' ? [45, 110] : [65, 120]
  if (riwayat.length === 0) return [batasTabel[0], Math.min(batasTabel[1], batasTabel[0] + 30)]

  const nilai = riwayat.map((r) => r.panjangTerkoreksiCm)
  const min = Math.min(...nilai)
  const maks = Math.max(...nilai)

  let dari = Math.max(batasTabel[0], Math.floor((min - 4) / 5) * 5)
  let sampai = Math.min(batasTabel[1], Math.ceil((maks + 6) / 5) * 5)

  const LEBAR_MIN = 15
  if (sampai - dari < LEBAR_MIN) {
    sampai = Math.min(batasTabel[1], dari + LEBAR_MIN)
    dari = Math.max(batasTabel[0], sampai - LEBAR_MIN)
  }

  return [dari, sampai]
}

/**
 * Standar yang berlaku menurut umur.
 */
export function basisUntukUmur(umurBulan: number): IndikatorPanjang {
  return umurBulan < 24 ? 'bbpb' : 'bbtb'
}

// ---------------------------------------------------------------------------
// Kurva berbasis umur: BB/U dan TB/U
// ---------------------------------------------------------------------------

export function seriBBU(
  riwayat: KunjunganRiwayat[],
  seks: JenisKelamin,
  rentangKustom?: [number, number],
): SeriKurva {
  const [dari, sampai] = rentangKustom ?? jendelaUmur(riwayat)
  const langkahGambar = sampai - dari > 24 ? 1 : 0.5

  const rujukan = bangunRujukan(
    tabelUmur('bbu', seks),
    LANGKAH_UMUR_BULAN,
    dari,
    sampai,
    langkahGambar,
  )

  const anak: TitikAnak[] = riwayat
    .filter((r) => r.umurBulan >= dari && r.umurBulan <= sampai)
    .map((r) => ({
      x: Math.round(r.umurBulan * 100) / 100,
      y: r.beratKg,
      tanggal: r.tanggalPeriksa,
      z: r.zBbu,
      standar: r.standarPanjang,
      tidakDinilai: r.zBbu === null,
    }))
    .sort((a, b) => a.x - b.x)

  return {
    indikator: 'bbu',
    judul: `Berat badan menurut umur ${seks === 'lk' ? 'Laki-laki' : 'Perempuan'} (0–60 bulan)`,
    labelX: 'Umur (bulan)',
    labelY: 'Berat badan (kg)',
    rujukan,
    anak,
    domainX: [dari, sampai],
    domainY: domainDari(rujukan, anak),
    seks,
    catatan: catatanUmum(riwayat, anak),
  }
}

export function seriTBU(
  riwayat: KunjunganRiwayat[],
  seks: JenisKelamin,
  rentangKustom?: [number, number],
): SeriKurva {
  const [dari, sampai] = rentangKustom ?? jendelaUmur(riwayat)
  const langkahGambar = sampai - dari > 24 ? 1 : 0.5

  const rujukan = bangunRujukan(
    tabelUmur('tbu', seks),
    LANGKAH_UMUR_BULAN,
    dari,
    sampai,
    langkahGambar,
  )

  const anak: TitikAnak[] = riwayat
    .filter((r) => r.umurBulan >= dari && r.umurBulan <= sampai)
    .map((r) => ({
      x: Math.round(r.umurBulan * 100) / 100,
      y: r.panjangTerkoreksiCm,
      tanggal: r.tanggalPeriksa,
      z: r.zTbu,
      standar: r.standarPanjang,
      tidakDinilai: r.zTbu === null,
    }))
    .sort((a, b) => a.x - b.x)

  const catatan = catatanUmum(riwayat, anak)
  if (dari < 24 && sampai >= 24) {
    catatan.push(
      'Pada umur 24 bulan standar WHO berpindah dari panjang badan terlentang ke ' +
        'tinggi badan berdiri, sehingga garis rujukan sedikit bergeser di titik itu. ' +
        'Pergeseran itu normal dan bukan tanda kesalahan pengukuran.',
    )
  }

  return {
    indikator: 'tbu',
    judul: `Panjang atau tinggi badan menurut umur ${seks === 'lk' ? 'Laki-laki' : 'Perempuan'} (0–60 bulan)`,
    labelX: 'Umur (bulan)',
    labelY: 'Panjang atau tinggi badan (cm)',
    rujukan,
    anak,
    domainX: [dari, sampai],
    domainY: domainDari(rujukan, anak),
    seks,
    catatan,
  }
}

// ---------------------------------------------------------------------------
// Kurva BB/TB
// ---------------------------------------------------------------------------

export function seriBBTB(
  riwayat: KunjunganRiwayat[],
  seks: JenisKelamin,
  basisPaksa?: IndikatorPanjang,
  rentangKustom?: [number, number],
): SeriKurva {
  const terakhir = [...riwayat].sort((a, b) =>
    a.tanggalPeriksa < b.tanggalPeriksa ? -1 : 1,
  )[riwayat.length - 1]

  const basis: IndikatorPanjang =
    basisPaksa ?? (terakhir ? basisUntukUmur(terakhir.umurBulan) : 'bbpb')

  const [dari, sampai] = rentangKustom ?? jendelaPanjang(riwayat, basis)

  const rujukan = bangunRujukan(
    tabelPanjang(basis, seks),
    LANGKAH_PANJANG_CM,
    dari,
    sampai,
    LANGKAH_PANJANG_CM,
  )

  const standarBasis: StandarPanjang = basis === 'bbpb' ? 'terlentang' : 'berdiri'

  const anak: TitikAnak[] = riwayat
    .filter((r) => r.panjangTerkoreksiCm >= dari && r.panjangTerkoreksiCm <= sampai)
    .map((r) => ({
      x: r.panjangTerkoreksiCm,
      y: r.beratKg,
      tanggal: r.tanggalPeriksa,
      z: r.zBbtb,
      standar: r.standarPanjang,
      tidakDinilai: r.zBbtb === null,
    }))
    .sort((a, b) => a.x - b.x)

  const catatan = catatanUmum(riwayat, anak)

  const jumlahBeda = anak.filter((t) => t.standar !== standarBasis).length
  if (jumlahBeda > 0) {
    catatan.push(
      `Garis rujukan memakai standar ${
        basis === 'bbpb' ? 'berat badan menurut panjang badan terlentang' : 'berat badan menurut tinggi badan berdiri'
      }, yaitu standar yang berlaku pada pemeriksaan terakhir. ` +
        `${jumlahBeda} titik pada kurva ini berasal dari standar yang lain karena umur anak ` +
        'saat itu belum atau sudah melewati 24 bulan. Nilai Z pada setiap titik tetap ' +
        'dihitung dengan standar yang benar untuk umurnya, sehingga status gizi tidak terpengaruh.',
    )
  }

  return {
    indikator: 'bbtb',
    judul:
      basis === 'bbpb'
        ? `Berat badan menurut panjang badan ${seks === 'lk' ? 'Laki-laki' : 'Perempuan'} (45–110 cm, terlentang)`
        : `Berat badan menurut tinggi badan ${seks === 'lk' ? 'Laki-laki' : 'Perempuan'} (65–120 cm, berdiri)`,
    labelX: basis === 'bbpb' ? 'Panjang badan (cm)' : 'Tinggi badan (cm)',
    labelY: 'Berat badan (kg)',
    rujukan,
    anak,
    domainX: [dari, sampai],
    domainY: domainDari(rujukan, anak),
    seks,
    catatan,
  }
}

function catatanUmum(riwayat: KunjunganRiwayat[], anak: TitikAnak[]): string[] {
  const catatan: string[] = []

  if (riwayat.length === 1) {
    catatan.push(
      'Baru ada satu kali pengukuran, sehingga arah pertumbuhan belum dapat dinilai. ' +
        'Arah pertumbuhan mulai terlihat setelah dua kali pengukuran atau lebih.',
    )
  }

  const dibuang = riwayat.length - anak.length
  if (dibuang > 0) {
    catatan.push(
      `${dibuang} pengukuran tidak tampil pada kurva ini karena berada di luar rentang ` +
        'standar WHO yang dipakai aplikasi.',
    )
  }

  const tidakDinilai = anak.filter((t) => t.tidakDinilai).length
  if (tidakDinilai > 0) {
    catatan.push(
      `${tidakDinilai} titik digambar tanpa nilai Z, karena indikator ini tidak dapat ` +
        'dinilai pada pemeriksaan tersebut.',
    )
  }

  return catatan
}

// ---------------------------------------------------------------------------
// Tren nilai Z
// ---------------------------------------------------------------------------

export type TitikTrenZ = {
  umurBulan: number
  tanggal: string
  bbu: number | null
  tbu: number | null
  bbtb: number | null
}

export type SeriTrenZ = {
  judul: string
  titik: TitikTrenZ[]
  domainX: [number, number]
  domainY: [number, number]
  catatan: string[]
}

export function seriTrenZ(riwayat: KunjunganRiwayat[]): SeriTrenZ {
  const titik = [...riwayat]
    .sort((a, b) => a.umurBulan - b.umurBulan)
    .map((r) => ({
      umurBulan: Math.round(r.umurBulan * 100) / 100,
      tanggal: r.tanggalPeriksa,
      bbu: r.zBbu,
      tbu: r.zTbu,
      bbtb: r.zBbtb,
    }))

  const [dari, sampai] = jendelaUmur(riwayat)

  const semuaZ = titik
    .flatMap((t) => [t.bbu, t.tbu, t.bbtb])
    .filter((z): z is number => z !== null)

  const bawah = semuaZ.length > 0 ? Math.min(-4, Math.floor(Math.min(...semuaZ))) : -4
  const atas = semuaZ.length > 0 ? Math.max(4, Math.ceil(Math.max(...semuaZ))) : 4

  const catatan: string[] = [
    'Garis pada -2 dan -3 simpang baku adalah batas kewaspadaan. Nilai Z yang menurun ' +
      'dari waktu ke waktu menandakan pertumbuhan lebih lambat daripada standar, ' +
      'meskipun berat badan anak bertambah.',
  ]

  if (titik.length < 2) {
    catatan.push('Tren memerlukan minimal dua kali pengukuran.')
  }

  return {
    judul: 'Tren nilai Z ketiga indikator',
    titik,
    domainX: [dari, sampai],
    domainY: [bawah, atas],
    catatan,
  }
}

/**
 * Menyusun ketiga kurva sekaligus. Dipakai halaman profil balita.
 */
export function semuaKurva(
  riwayat: KunjunganRiwayat[],
  seks: JenisKelamin,
): { bbu: SeriKurva; tbu: SeriKurva; bbtb: SeriKurva; trenZ: SeriTrenZ } {
  return {
    bbu: seriBBU(riwayat, seks),
    tbu: seriTBU(riwayat, seks),
    bbtb: seriBBTB(riwayat, seks),
    trenZ: seriTrenZ(riwayat),
  }
}

export type { IndikatorPanjang, IndikatorUmur, JenisKelamin }
