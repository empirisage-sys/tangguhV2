/**
 * Bentuk data balita yang dipakai seluruh layar, beserta pemetaannya dari baris
 * Supabase.
 *
 * ==========================================================================
 * MENGAPA BERKAS INI ADA
 *
 * Sampai patch ini, sembilan berkas membaca `SAMPLE_BALITA_DATABASE` di
 * `balita-mock.ts` — sebuah senarai yang isinya `[]`. Akibatnya seluruh jalur
 * BACA aplikasi ini mati meskipun jalur TULIS sudah lama tersambung ke
 * Supabase: `balita/baru/actions.ts` benar-benar menyimpan balita ke Postgres,
 * lalu mengalihkan ke `/balita/{id}` yang memanggil `cariBalitaById` pada
 * senarai kosong dan berakhir `notFound()`. Kader mendaftarkan balita,
 * berhasil, lalu melihat halaman 404.
 *
 * Berkas ini memuat BENTUK dan PEMETAANNYA saja — murni, tanpa jaringan —
 * sehingga dapat diuji tanpa database. Pembacaan sesungguhnya ada di
 * `balita-server.ts`, yang hanya boleh dipanggil di sisi server.
 *
 * PENYARINGAN WILAYAH TIDAK DILAKUKAN DI SINI, dan tidak boleh. Policy RLS
 * `baca balita sesuai cakupan` dan `baca skrining sesuai cakupan` sudah
 * menegakkannya di database lewat `boleh_akses_balita`, termasuk aturan khusus
 * dokter spesialis anak. Menyaring ulang di kode aplikasi berarti membuat
 * sumber kebenaran kedua yang bisa berselisih dengan yang pertama.
 * ==========================================================================
 */
import type { StandarPanjang, StatusBBU, StatusTBU, StatusBBTB } from '@/lib/zscore/tipe'
import type { KunjunganRiwayat } from '@/lib/grafik/seri'
import { posisiDariDb } from './pemetaan'
import type { PosisiUkur } from '@/lib/zscore/tipe'

export type SkriningRiwayatItem = KunjunganRiwayat & {
  /** Id baris skrining. Dibutuhkan agar peresepan PKMK dapat merujuknya. */
  id: string
  tanggal: string
  panjangCm: number
  posisiUkur: PosisiUkur
  z_bbu: number | null
  z_tbu: number | null
  z_bbtb: number | null
  statusBBU: StatusBBU | null
  statusTBU: StatusTBU | null
  statusBBTB: StatusBBTB | null
  edema?: boolean
  lilaCm?: number | null
  diLuarRentang: boolean
  catatanDiLuarRentang?: string | null
  isRedFlag: boolean
  /**
   * Kebutuhan energi tumbuh kejar, kkal per hari, dari kolom
   * `skrining.kalori_catchup_kkal`. WAJIB ada di bentuk riwayat karena panel
   * PKMK menurunkan seluruh takarannya dari angka ini; tanpa itu, layar dahulu
   * memakai angka literal 770 sementara server memakai angka sebenarnya.
   * Lihat temuan audit P-1.
   */
  kaloriCatchUpKkal?: number | null
  /** Kebutuhan pemeliharaan, kkal per hari. */
  kaloriPemeliharaanKkal?: number | null
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
  usiaGestasiMinggu?: number
  createdBy?: string | null
  /** Diurutkan dari kunjungan paling lama ke paling baru. */
  riwayat: SkriningRiwayatItem[]
}

/** Nama wilayah dari relasi bersarang Supabase, yang dapat berbentuk objek atau senarai. */
function namaRelasi(nilai: unknown): string {
  if (Array.isArray(nilai)) return namaRelasi(nilai[0])
  if (nilai && typeof nilai === 'object' && 'nama' in nilai) {
    const nama = (nilai as { nama?: unknown }).nama
    return typeof nama === 'string' ? nama : ''
  }
  return ''
}

function angkaAtauNull(nilai: unknown): number | null {
  if (nilai === null || nilai === undefined || nilai === '') return null
  const n = Number(nilai)
  return Number.isFinite(n) ? n : null
}

function tekstAtauUndefined(nilai: unknown): string | undefined {
  return typeof nilai === 'string' && nilai.length > 0 ? nilai : undefined
}

/**
 * Memetakan satu baris `skrining` menjadi bentuk riwayat.
 *
 * Nilai Z dan status DIBACA APA ADANYA dari database, tidak dihitung ulang di
 * sini. Yang tersimpan adalah hasil hitung server pada saat pencatatan, dan
 * itulah yang menjadi rekam medisnya. Menghitung ulang saat menampilkan berarti
 * angka di layar dapat berbeda dari angka yang tercatat begitu mesin z-score
 * naik versi — persis kebalikan dari tujuan kolom `engine_version` ada.
 */
export function petakanSkriningKeRiwayat(r: Record<string, unknown>): SkriningRiwayatItem {
  const panjangTerkoreksi = angkaAtauNull(r.panjang_terkoreksi_cm)
  const panjang = angkaAtauNull(r.panjang_cm)

  return {
    id: String(r.id ?? ''),
    tanggal: String(r.tanggal_periksa ?? ''),
    tanggalPeriksa: String(r.tanggal_periksa ?? ''),
    umurBulan: angkaAtauNull(r.umur_bulan) ?? 0,
    beratKg: angkaAtauNull(r.berat_kg) ?? 0,
    panjangCm: panjang ?? panjangTerkoreksi ?? 0,
    panjangTerkoreksiCm: panjangTerkoreksi ?? panjang ?? 0,
    standarPanjang:
      (angkaAtauNull(r.umur_bulan) ?? 0) < 24
        ? ('terlentang' as StandarPanjang)
        : ('berdiri' as StandarPanjang),
    posisiUkur: posisiDariDb(
      (r.posisi_ukur as 'recumbent' | 'standing' | 'auto' | undefined) ?? 'auto',
    ),
    zBbu: angkaAtauNull(r.z_bbu),
    zTbu: angkaAtauNull(r.z_tbu),
    zBbtb: angkaAtauNull(r.z_bbtb),
    z_bbu: angkaAtauNull(r.z_bbu),
    z_tbu: angkaAtauNull(r.z_tbu),
    z_bbtb: angkaAtauNull(r.z_bbtb),
    statusBBU: (r.status_bbu as StatusBBU | null) ?? null,
    statusTBU: (r.status_tbu as StatusTBU | null) ?? null,
    statusBBTB: (r.status_bbtb as StatusBBTB | null) ?? null,
    edema: r.edema === true,
    lilaCm: angkaAtauNull(r.lila_cm),
    diLuarRentang: r.di_luar_rentang === true,
    catatanDiLuarRentang: tekstAtauUndefined(r.catatan_di_luar_rentang) ?? null,
    isRedFlag: r.is_red_flag === true,
    kaloriCatchUpKkal: angkaAtauNull(r.kalori_catchup_kkal),
    kaloriPemeliharaanKkal: angkaAtauNull(r.kalori_target_kkal),
  }
}

/**
 * Memetakan satu baris `balita` beserta relasi wilayah dan riwayat skriningnya.
 *
 * Berat lahir disimpan database dalam GRAM, sedangkan seluruh layar memakai
 * KILOGRAM. Pembagian itu dilakukan di sini, satu kali, supaya tidak ada layar
 * yang menampilkan 3.200 kg.
 */
export function petakanBalitaKeDetail(
  r: Record<string, unknown>,
  barisSkrining: Record<string, unknown>[] = [],
): BalitaDetail {
  const bbLahirGram = angkaAtauNull(r.bb_lahir_gram)

  return {
    id: String(r.id ?? ''),
    nama: String(r.nama ?? ''),
    nik: tekstAtauUndefined(r.nik),
    tanggalLahir: String(r.tanggal_lahir ?? ''),
    jenisKelamin: r.jenis_kelamin === 'P' ? 'P' : 'L',
    namaIbu: tekstAtauUndefined(r.nama_ibu),
    namaAyah: tekstAtauUndefined(r.nama_ayah),
    noHpOrtu: tekstAtauUndefined(r.no_hp_ortu),
    alamat: tekstAtauUndefined(r.alamat),
    posyanduId: String(r.posyandu_id ?? ''),
    puskesmasId: String(r.puskesmas_id ?? ''),
    kabupatenId: String(r.kabupaten_id ?? ''),
    namaPosyandu: namaRelasi(r.posyandu),
    namaPuskesmas: namaRelasi(r.puskesmas),
    namaKabupaten: namaRelasi(r.kabupaten),
    bbLahirKg: bbLahirGram === null ? undefined : Math.round((bbLahirGram / 1000) * 100) / 100,
    pbLahirCm: angkaAtauNull(r.pb_lahir_cm) ?? undefined,
    usiaGestasiMinggu: angkaAtauNull(r.usia_gestasi_minggu) ?? undefined,
    createdBy: typeof r.created_by === 'string' ? r.created_by : null,
    riwayat: barisSkrining
      .map(petakanSkriningKeRiwayat)
      // Kurva pertumbuhan dan evaluasi kenaikan berat menuntut urutan dari
      // paling lama ke paling baru. Kueri mengambil terbaru lebih dahulu agar
      // batas jumlahnya bermakna, jadi urutannya dibalik di sini.
      .sort((a, b) => a.tanggalPeriksa.localeCompare(b.tanggalPeriksa)),
  }
}

/** Kunjungan terakhir, atau `null` bila balita belum pernah ditimbang. */
export function kunjunganTerakhir(balita: BalitaDetail): SkriningRiwayatItem | null {
  return balita.riwayat.length > 0 ? (balita.riwayat[balita.riwayat.length - 1] as SkriningRiwayatItem) : null
}
