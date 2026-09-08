/**
 * Penjaga otorisasi untuk Server Action dan Server Component.
 *
 * Ada satu alasan berkas ini dibuat: agar tidak ada Server Action yang lupa
 * memeriksa peran. Setiap tindakan yang menyentuh data balita memanggil salah
 * satu fungsi di sini sebagai baris pertama.
 *
 * TIGA LAPIS OTORISASI, DAN MASING-MASING TIDAK MENGGANTIKAN YANG LAIN
 *   1. proxy.ts        mengalihkan pengguna tanpa sesi ke halaman masuk
 *   2. berkas ini      memeriksa peran dan status akun di setiap tindakan
 *   3. policy RLS      pertahanan terakhir di dalam database
 *
 * Lapisan pertama hanya soal navigasi, bukan keamanan. Seseorang yang memanggil
 * Server Action secara langsung tidak melewati proxy sama sekali.
 */
import { createClient } from './server'
import type { Peran } from '@/lib/tampilan/akses'

export type ProfilAktif = {
  id: string
  namaLengkap: string
  peran: Peran
  statusAkun: 'menunggu' | 'disetujui' | 'ditolak'
  alasanTolak: string | null
  posyanduId: string | null
  faskesId: string | null
  puskesmasId: string | null
  kabupatenId: string | null
  provinsiId: string | null
  jenisFaskes: 'puskesmas' | 'rumah_sakit' | null
}

export class TidakBerwenangError extends Error {
  constructor(pesan: string) {
    super(pesan)
    this.name = 'TidakBerwenangError'
  }
}

/**
 * Membaca profil pengguna yang sedang masuk, apa pun status akunnya.
 *
 * Memakai `getClaims()`, bukan `getSession()`. `getSession()` membaca cookie apa
 * adanya tanpa memverifikasi tanda tangannya, sehingga tidak boleh dipakai untuk
 * keputusan otorisasi di sisi server.
 *
 * Mengembalikan `null` bila tidak ada sesi atau profil tidak ditemukan.
 */
export async function ambilProfil(): Promise<ProfilAktif | null> {
  const supabase = await createClient()

  const { data: klaim } = await supabase.auth.getClaims()
  const penggunaId = klaim?.claims?.sub
  if (!penggunaId) return null

  const { data } = await supabase
    .from('profiles')
    .select(
      'id, nama_lengkap, role, status_akun, alasan_tolak, posyandu_id, faskes_id, puskesmas_id, kabupaten_id, provinsi_id, jenis_faskes',
    )
    .eq('id', penggunaId)
    .maybeSingle()

  if (!data) return null

  // ==========================================================================
  // `puskesmasId` DAN `faskesId` TIDAK BOLEH DISATUKAN
  //
  // Sebelumnya keduanya diisi nilai yang sama, yaitu `faskes_id || puskesmas_id`.
  // Itu keliru, dan akibatnya nyata:
  //
  //   - `profiles.puskesmas_id` menunjuk tabel `puskesmas`
  //   - `profiles.faskes_id`    menunjuk tabel `faskes`, yang juga memuat
  //                             rumah sakit
  //
  // Bagi pengguna yang bertugas di RUMAH SAKIT, `faskes_id` berisi id rumah
  // sakit. Dengan penyatuan lama, `profil.puskesmasId` pun menjadi id rumah
  // sakit itu, lalu dituliskan ke `balita.puskesmas_id` dan
  // `asuhan_gizi.puskesmas_id` — dua kolom yang berkunci-asing ke tabel
  // `puskesmas`. Penyimpanan pasti gagal, dan seandainya lolos, policy RLS
  // membandingkannya dengan `my_puskesmas_id()` yang membaca kolom
  // `puskesmas_id` apa adanya, sehingga hasilnya tidak pernah cocok.
  //
  // Sejak sini: `puskesmasId` adalah kolom puskesmas apa adanya, persis
  // sebagaimana `my_puskesmas_id()` membacanya. `faskesId` tetap memakai
  // cadangan puskesmas, karena itulah yang dimaksud "fasilitas tempat
  // bertugas" dan `my_faskes_id()` di Postgres pun berperilaku demikian.
  //
  // `src/lib/tampilan/akses.ts` sudah memakai pola `a || b` sendiri pada
  // kedua medan ini, sehingga pemisahan ini tidak mengubah perilakunya.
  // ==========================================================================
  return {
    id: data.id,
    namaLengkap: data.nama_lengkap,
    peran: data.role as Peran,
    statusAkun: data.status_akun as ProfilAktif['statusAkun'],
    alasanTolak: data.alasan_tolak,
    posyanduId: data.posyandu_id,
    faskesId: data.faskes_id || data.puskesmas_id,
    puskesmasId: data.puskesmas_id,
    kabupatenId: data.kabupaten_id,
    provinsiId: data.provinsi_id,
    jenisFaskes: data.jenis_faskes as ProfilAktif['jenisFaskes'],
  }
}

/**
 * Profil yang sudah disetujui admin.
 *
 * Sejak seluruh peran wajib melalui persetujuan, tidak ada pengecualian untuk
 * kader. Mengembalikan `null` bila akun masih menunggu atau ditolak.
 */
export async function ambilProfilDisetujui(): Promise<ProfilAktif | null> {
  const profil = await ambilProfil()
  if (!profil) return null
  if (profil.statusAkun !== 'disetujui') return null
  return profil
}

/**
 * Menuntut akun yang sudah disetujui dengan salah satu peran tertentu.
 *
 * Melempar galat bila tidak memenuhi. Server Action menangkapnya dan
 * mengembalikan pesan yang layak dibaca pengguna, bukan meneruskan galat mentah.
 */
export async function wajibPeran(peran: Peran[]): Promise<ProfilAktif> {
  const profil = await ambilProfilDisetujui()

  if (!profil) {
    throw new TidakBerwenangError(
      'Akun Anda belum diverifikasi admin, sehingga tindakan ini belum dapat dilakukan.',
    )
  }

  if (!peran.includes(profil.peran)) {
    throw new TidakBerwenangError('Tindakan ini bukan kewenangan peran Anda.')
  }

  return profil
}

/**
 * Wilayah yang dipakai saat menulis data balita dan skrining.
 *
 * Diambil dari profil pengguna di server, TIDAK PERNAH dari masukan formulir.
 * Bila diambil dari formulir, seorang kader dapat menuliskan wilayah lain dan
 * menyisipkan data ke posyandu yang bukan wewenangnya. Policy RLS akan
 * menolaknya, tetapi menolak di sini memberi pesan yang lebih jelas dan
 * menghemat satu perjalanan ke database.
 */
export function wilayahUntukMenulis(profil: ProfilAktif): WilayahTulis {
  if (!profil.posyanduId || !profil.puskesmasId || !profil.kabupatenId) {
    throw new TidakBerwenangError(
      'Wilayah kerja pada profil Anda belum lengkap. Hubungi admin untuk melengkapinya.',
    )
  }
  return {
    posyanduId: profil.posyanduId,
    puskesmasId: profil.puskesmasId,
    kabupatenId: profil.kabupatenId,
  }
}

export type WilayahTulis = {
  posyanduId: string
  puskesmasId: string
  kabupatenId: string
}

/**
 * Pola UUID. Menolak masukan yang jelas bukan uuid SEBELUM menyentuh database,
 * sehingga string sembarang dari formulir tidak pernah menjadi bagian kueri.
 */
const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Apakah peran ini memilih sendiri posyandu tempat balita dicatat.
 *
 * Kader terikat pada satu posyandu, sehingga tidak pernah memilih. Dokter dan
 * dietisien terdaftar di tingkat puskesmas dan membina banyak posyandu; profil
 * mereka memang tidak memiliki `posyandu_id` (lihat `daftar/actions.ts`, yang
 * hanya mengisinya untuk kader), sehingga posyandu harus ditentukan saat
 * pencatatan.
 */
export function perluMemilihPosyandu(profil: ProfilAktif): boolean {
  return !profil.posyanduId
}

/**
 * Wilayah yang dipakai saat MENDAFTARKAN BALITA BARU.
 *
 * Berbeda dengan `wilayahUntukMenulis`, fungsi ini menerima pilihan posyandu
 * dari formulir untuk peran yang profilnya tidak terikat satu posyandu.
 *
 * TIGA HAL YANG MEMBUAT PENERIMAAN ITU AMAN
 *
 *   1. Pilihan DIABAIKAN sepenuhnya bila profil sudah punya `posyandu_id`.
 *      Seorang kader karena itu tetap tidak dapat menulis ke posyandu lain
 *      meskipun ia menyisipkan medan `posyanduId` ke dalam kiriman formulir.
 *
 *   2. Pilihan diverifikasi ke database: posyandu itu harus benar-benar berada
 *      di bawah puskesmas pengguna. Tanpa langkah ini ada lubang yang nyata,
 *      karena `puskesmas_id` pada baris balita diambil dari profil, bukan dari
 *      posyandu yang dipilih. Sebuah posyandu milik puskesmas lain akan lolos
 *      policy RLS `boleh_akses_balita`, sebab yang diperiksa policy hanyalah
 *      kolom `puskesmas_id` — yang sudah terlanjur benar. Baris balita menjadi
 *      tidak konsisten: posyandu menunjuk ke wilayah A, puskesmas ke wilayah B.
 *
 *   3. Kegagalan apa pun keluar sebagai `TidakBerwenangError`, sehingga Server
 *      Action mengembalikannya sebagai pesan yang dapat dibaca pengguna.
 */
export async function wilayahUntukMenulisBalita(
  profil: ProfilAktif,
  posyanduIdPilihan: string | null,
): Promise<WilayahTulis> {
  if (!profil.puskesmasId || !profil.kabupatenId) {
    throw new TidakBerwenangError(
      'Wilayah kerja pada profil Anda belum lengkap. Hubungi admin untuk melengkapinya.',
    )
  }

  // Profil yang terikat satu posyandu memakai posyandu itu, titik.
  if (profil.posyanduId) {
    return {
      posyanduId: profil.posyanduId,
      puskesmasId: profil.puskesmasId,
      kabupatenId: profil.kabupatenId,
    }
  }

  if (!posyanduIdPilihan || !POLA_UUID.test(posyanduIdPilihan)) {
    throw new TidakBerwenangError(
      'Pilih dulu posyandu tempat balita ini akan dicatat.',
    )
  }

  const supabase = await createClient()
  const { data } = await supabase
    .from('posyandu')
    .select('id')
    .eq('id', posyanduIdPilihan)
    .eq('puskesmas_id', profil.puskesmasId)
    .maybeSingle()

  if (!data) {
    throw new TidakBerwenangError(
      'Posyandu yang dipilih tidak berada di wilayah kerja Anda.',
    )
  }

  return {
    posyanduId: data.id,
    puskesmasId: profil.puskesmasId,
    kabupatenId: profil.kabupatenId,
  }
}

/**
 * Daftar posyandu di bawah puskesmas pengguna, untuk mengisi pilihan di
 * formulir. Mengembalikan senarai kosong bila profil belum punya puskesmas.
 */
export async function daftarPosyanduWilayah(
  profil: ProfilAktif,
): Promise<{ id: string; nama: string; desa: string | null }[]> {
  if (!profil.puskesmasId) return []

  const supabase = await createClient()
  const { data } = await supabase
    .from('posyandu')
    .select('id, nama, desa')
    .eq('puskesmas_id', profil.puskesmasId)
    .order('nama')

  return (data ?? []).map((p) => ({
    id: p.id as string,
    nama: p.nama as string,
    desa: (p.desa as string | null) ?? null,
  }))
}
