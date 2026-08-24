/**
 * Aturan akses per peran di lapisan tampilan.
 *
 * Berkas ini murni dan teruji. Ia menentukan apa yang TAMPIL untuk masing-masing
 * peran.
 *
 * PENTING — ini bukan lapisan keamanan.
 * Menyembunyikan tab tidak mencegah siapa pun mengambil datanya. Keamanan
 * ditegakkan oleh policy RLS di database dan pemeriksaan peran di Server Action.
 * Berkas ini hanya mengatur apa yang layak ditampilkan agar antarmuka tidak
 * membebani pengguna dengan hal yang bukan urusannya.
 */

export type Peran = 'kader' | 'dokter' | 'dietisien' | 'admin'

export type StatusAkun = 'menunggu' | 'disetujui' | 'ditolak'

export type TabKurva = 'bbu' | 'tbu' | 'bbtb' | 'trenZ'

/**
 * Tab kurva yang ditampilkan untuk sebuah peran.
 *
 * Tren nilai Z hanya untuk dokter dan admin. Kurva itu paling informatif secara
 * klinis, tetapi juga paling menuntut pemahaman: nilai Z yang menurun sementara
 * berat badan naik memerlukan penafsiran, bukan sekadar pembacaan. Menampilkannya
 * kepada kader berisiko menimbulkan kesimpulan yang keliru tanpa ada yang
 * mendampingi.
 *
 * Dietisien tetap memakai tiga kurva WHO beserta angka nilai Z pada tabel
 * riwayat, yang sudah cukup untuk menyusun asuhan gizi.
 */
export function tabKurvaUntuk(peran: Peran): TabKurva[] {
  const dasar: TabKurva[] = ['bbu', 'tbu', 'bbtb']
  if (peran === 'dokter' || peran === 'admin') return [...dasar, 'trenZ']
  return dasar
}

export function bolehLihatTrenZ(peran: Peran): boolean {
  return tabKurvaUntuk(peran).includes('trenZ')
}

export const LABEL_TAB: Record<TabKurva, string> = {
  bbu: 'BB/U',
  tbu: 'TB/U',
  bbtb: 'BB/TB',
  trenZ: 'Tren Z',
}

/**
 * Pesan yang ditampilkan menurut status akun.
 *
 * Sejak keputusan bahwa SELURUH peran wajib melalui persetujuan admin, kader pun
 * dapat berada dalam keadaan menunggu. Pesannya harus menjelaskan apa yang
 * sedang terjadi dan apa yang bisa dilakukan, bukan sekadar menolak masuk.
 */
export type PesanStatus = {
  judul: string
  penjelasan: string
  tindakan: string | null
  nada: 'aman' | 'waspada' | 'bahaya' | 'netral'
}

export function pesanStatusAkun(
  status: StatusAkun,
  peran: Peran,
  alasanTolak?: string | null,
): PesanStatus {
  if (status === 'disetujui') {
    return {
      judul: 'Akun aktif',
      penjelasan: 'Akun Anda sudah diverifikasi dan dapat dipakai sepenuhnya.',
      tindakan: null,
      nada: 'aman',
    }
  }

  if (status === 'ditolak') {
    return {
      judul: 'Pendaftaran belum dapat disetujui',
      penjelasan:
        alasanTolak && alasanTolak.trim().length > 0
          ? alasanTolak
          : 'Admin belum dapat menyetujui pendaftaran ini. ' +
            'Hubungi admin untuk mengetahui alasannya.',
      tindakan: 'Hubungi admin atau petugas puskesmas pembina.',
      nada: 'bahaya',
    }
  }

  const keterangan =
    peran === 'kader'
      ? 'Admin perlu memastikan Anda benar bertugas di posyandu yang dipilih.'
      : 'Admin perlu memeriksa nomor STR yang Anda cantumkan.'

  return {
    judul: 'Menunggu verifikasi admin',
    penjelasan:
      `Pendaftaran Anda sudah masuk dan sedang menunggu persetujuan. ${keterangan} ` +
      'Selama menunggu, Anda belum dapat mencatat maupun melihat data balita.',
    tindakan:
      'Bila mendesak, hubungi petugas puskesmas pembina agar pendaftaran Anda ' +
      'didahulukan. Akun tidak perlu didaftarkan ulang.',
    nada: 'waspada',
  }
}

/** Apakah peran ini dapat mencatat skrining, bila akunnya sudah disetujui. */
export function bolehMencatatSkrining(peran: Peran): boolean {
  return peran === 'kader' || peran === 'dokter' || peran === 'dietisien'
}

/** Apakah peran ini dapat menyusun asuhan gizi. */
export function bolehMenyusunAsuhanGizi(peran: Peran): boolean {
  return peran === 'dietisien'
}

/** Apakah peran ini dapat memverifikasi pendaftaran orang lain. */
export function bolehMemverifikasi(peran: Peran): boolean {
  return peran === 'admin'
}

/** Apakah nomor STR wajib diisi saat pendaftaran. */
export function strWajib(peran: Peran): boolean {
  return peran === 'dokter' || peran === 'dietisien'
}

/** Apakah posyandu wajib dipilih saat pendaftaran. */
export function posyanduWajib(peran: Peran): boolean {
  return peran === 'kader'
}

export type CakupanData = 'posyandu' | 'faskes' | 'input_sendiri' | 'provinsi'

/**
 * Menentukan cakupan data balita yang boleh dilihat oleh pengguna (Keputusan D-9).
 * - Kader: balita di posyandu tempat bertugas
 * - Dokter / Dietisien di Puskesmas: balita di puskesmas tempat bertugas
 * - Spesialis / Nakes di Rumah Sakit: HANYA balita yang diinput sendiri
 * - Admin: seluruh provinsi
 */
export function cakupanData(
  peran: Peran,
  jenisFaskes?: 'puskesmas' | 'rumah_sakit' | null,
): CakupanData {
  if (peran === 'admin') return 'provinsi'
  if (peran === 'kader') return 'posyandu'
  if (peran === 'dokter' || peran === 'dietisien') {
    if (jenisFaskes === 'rumah_sakit') return 'input_sendiri'
    return 'faskes'
  }
  return 'input_sendiri'
}

