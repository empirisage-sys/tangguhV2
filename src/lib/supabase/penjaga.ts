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

  const fId = data.faskes_id || data.puskesmas_id

  return {
    id: data.id,
    namaLengkap: data.nama_lengkap,
    peran: data.role as Peran,
    statusAkun: data.status_akun as ProfilAktif['statusAkun'],
    alasanTolak: data.alasan_tolak,
    posyanduId: data.posyandu_id,
    faskesId: fId,
    puskesmasId: fId,
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
export function wilayahUntukMenulis(profil: ProfilAktif): {
  posyanduId: string
  puskesmasId: string
  kabupatenId: string
} {
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
