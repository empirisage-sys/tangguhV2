'use server'

/**
 * Pembuatan akun Dokter Spesialis Anak oleh Administrator.
 *
 * Alur:
 *   1. Admin mengisi nama, email, STR, rumah sakit, dan kata sandi sementara.
 *   2. Akun auth dibuat dengan email sudah terkonfirmasi, sehingga tidak
 *      bergantung pada surel (batas kirim surel bawaan Supabase sangat kecil).
 *      Metadata pendaftaran sama persis dengan pendaftaran mandiri, sehingga
 *      trigger `handle_new_user` yang menyusun profil dan menegakkan aturan
 *      wilayah, termasuk `chk_spesialis_anak_di_rs`.
 *   3. `app_metadata.wajib_ganti_sandi = true`: dokter dialihkan ke halaman
 *      ganti sandi saat masuk pertama, dan setiap tindakan ditolak penjaga
 *      sampai sandi diganti.
 *   4. Akun langsung disetujui lewat `verifikasi_pengguna` dengan sesi admin,
 *      sehingga persetujuan tercatat atas nama admin yang membuatnya.
 */
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { wajibPeran, TidakBerwenangError } from '@/lib/supabase/penjaga'
import { klienAuthAdmin, PESAN_KUNCI_TIDAK_ADA } from '@/lib/supabase/auth-admin'
import { normalkanNoHp, RS_BARU, skemaTambahDsaAdmin } from '@/lib/validasi/pendaftaran'
import type { HasilTindakan } from '@/app/(publik)/daftar/actions'

export async function adminTambahDokterSpesialisAnak(formData: FormData): Promise<HasilTindakan> {
  try {
    await wajibPeran(['admin'])
  } catch (galat) {
    if (galat instanceof TidakBerwenangError) return { ok: false, pesan: galat.message }
    throw galat
  }

  const hasil = skemaTambahDsaAdmin.safeParse({
    namaLengkap: formData.get('namaLengkap'),
    email: formData.get('email'),
    noHp: formData.get('noHp') ?? '',
    noStr: formData.get('noStr'),
    rumahSakitId: formData.get('rumahSakitId') ?? '',
    namaRsBaru: formData.get('namaRsBaru') ?? '',
    kabupatenId: formData.get('kabupatenId') ?? '',
    sandiSementara: formData.get('sandiSementara'),
  })
  if (!hasil.success) {
    const galatMedan: Record<string, string> = {}
    for (const isu of hasil.error.issues) galatMedan[String(isu.path[0] ?? 'umum')] ??= isu.message
    return { ok: false, pesan: hasil.error.issues[0]?.message ?? 'Isian belum lengkap.', galatMedan }
  }
  const d = hasil.data

  const authAdmin = klienAuthAdmin()
  if (!authAdmin) return { ok: false, pesan: PESAN_KUNCI_TIDAK_ADA }

  const supabase = await createClient()

  // Rumah sakit dari daftar: kabupatennya diambil dari data induk, bukan dari
  // formulir, agar profil dan rumah sakit selalu berada di kabupaten yang sama.
  let kabupatenId = d.kabupatenId ?? ''
  let faskesId = ''
  let namaRs = ''
  if (d.rumahSakitId !== RS_BARU) {
    const { data: rs } = await supabase
      .from('faskes')
      .select('id, nama, jenis, kabupaten_id')
      .eq('id', d.rumahSakitId)
      .maybeSingle()
    if (!rs || rs.jenis !== 'rumah_sakit') {
      return {
        ok: false,
        pesan: 'Rumah sakit yang dipilih tidak ditemukan. Muat ulang halaman lalu pilih kembali.',
        galatMedan: { rumahSakitId: 'Rumah sakit tidak ditemukan' },
      }
    }
    faskesId = rs.id
    namaRs = rs.nama
    kabupatenId = rs.kabupaten_id ?? kabupatenId
  } else {
    namaRs = (d.namaRsBaru ?? '').trim()
  }

  const { data: dibuat, error: galatBuat } = await authAdmin.createUser({
    email: d.email,
    password: d.sandiSementara,
    email_confirm: true,
    app_metadata: { wajib_ganti_sandi: true },
    user_metadata: {
      nama_lengkap: d.namaLengkap,
      role: 'dokter_spesialis_anak',
      no_hp: d.noHp ? normalkanNoHp(d.noHp) : '',
      no_str: d.noStr,
      kabupaten_id: kabupatenId,
      puskesmas_id: '',
      posyandu_id: '',
      faskes_id: faskesId,
      jenis_faskes: 'rumah_sakit',
      faskes_manual: faskesId ? '' : namaRs,
      posyandu_manual: '',
      dibuat_oleh_admin: true,
    },
  })

  if (galatBuat || !dibuat?.user) {
    const pesan = (galatBuat?.message ?? '').toLowerCase()
    console.error('[admin dsa] createUser gagal', { pesan: galatBuat?.message })
    if (pesan.includes('already') || pesan.includes('exists')) {
      return {
        ok: false,
        pesan: 'Email ini sudah terdaftar. Cari akunnya di daftar pengguna, lalu ubah perannya bila perlu.',
        galatMedan: { email: 'Email sudah terdaftar' },
      }
    }
    if (pesan.includes('database error')) {
      return {
        ok: false,
        pesan:
          'Profil dokter tidak dapat dibuat oleh database. Periksa kembali rumah sakit dan kabupaten yang dipilih.',
      }
    }
    return { ok: false, pesan: 'Akun tidak dapat dibuat. Coba lagi beberapa saat lagi.' }
  }

  const penggunaId = dibuat.user.id

  // Sahkan memakai sesi admin, agar tercatat di disetujui_oleh.
  const { error: galatSah } = await supabase.rpc('verifikasi_pengguna', {
    p_pengguna_id: penggunaId,
    p_setujui: true,
  })

  revalidatePath('/admin/pengguna')
  revalidatePath('/admin/verifikasi')

  if (galatSah) {
    return {
      ok: true,
      pesan:
        `Akun ${d.email} sudah dibuat, tetapi belum disahkan otomatis (${galatSah.message}). ` +
        'Sahkan dari menu Verifikasi.',
    }
  }

  return {
    ok: true,
    pesan:
      `Akun Dokter Spesialis Anak untuk ${d.namaLengkap} sudah aktif di ${namaRs}. ` +
      'Sampaikan email dan kata sandi sementara kepada dokter; ia wajib menggantinya saat masuk pertama kali.',
  }
}
