'use server'

/**
 * Pembuatan akun petugas (kader, dokter, dietisien, dokter spesialis anak)
 * oleh Administrator.
 *
 * Alur:
 *   1. Admin mengisi identitas, peran, wilayah, dan kata sandi sementara.
 *   2. Akun auth dibuat dengan email sudah terkonfirmasi, sehingga tidak
 *      bergantung pada surel (batas kirim surel bawaan Supabase sangat kecil).
 *      Metadata sama persis dengan pendaftaran mandiri, sehingga trigger
 *      `handle_new_user` yang menyusun profil dan menegakkan aturan wilayah.
 *   3. `app_metadata.wajib_ganti_sandi = true`: pengguna dialihkan ke halaman
 *      ganti sandi saat masuk pertama, dan setiap tindakan ditolak penjaga
 *      sampai sandi diganti.
 *   4. Akun langsung disetujui lewat `verifikasi_pengguna` dengan sesi admin,
 *      sehingga persetujuan tercatat atas nama admin yang membuatnya.
 */
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { wajibPeran, TidakBerwenangError } from '@/lib/supabase/penjaga'
import { klienAuthAdmin, PESAN_KUNCI_TIDAK_ADA } from '@/lib/supabase/auth-admin'
import {
  LABEL_PERAN,
  normalkanNoHp,
  POSYANDU_BARU,
  RS_BARU,
  skemaTambahPenggunaAdmin,
} from '@/lib/validasi/pendaftaran'
import type { HasilTindakan } from '@/app/(publik)/daftar/actions'

export async function adminTambahPengguna(formData: FormData): Promise<HasilTindakan> {
  try {
    await wajibPeran(['admin'])
  } catch (galat) {
    if (galat instanceof TidakBerwenangError) return { ok: false, pesan: galat.message }
    throw galat
  }

  const ambil = (k: string) => formData.get(k) ?? ''
  const hasil = skemaTambahPenggunaAdmin.safeParse({
    peran: formData.get('peran'),
    namaLengkap: formData.get('namaLengkap'),
    email: formData.get('email'),
    noHp: ambil('noHp'),
    noStr: ambil('noStr'),
    puskesmasId: ambil('puskesmasId'),
    posyanduId: ambil('posyanduId'),
    namaPosyanduBaru: ambil('namaPosyanduBaru'),
    rumahSakitId: ambil('rumahSakitId'),
    namaRsBaru: ambil('namaRsBaru'),
    kabupatenId: ambil('kabupatenId'),
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

  // Wilayah dibaca dari data induk, bukan dari formulir, agar profil, puskesmas,
  // posyandu, dan rumah sakit selalu berada di kabupaten yang sama.
  let kabupatenId = ''
  let puskesmasId = ''
  let posyanduId = ''
  let faskesId = ''
  let namaManualFaskes = ''
  let namaManualPosyandu = ''
  let namaTempat = ''

  if (d.peran === 'dokter_spesialis_anak') {
    if (d.rumahSakitId !== RS_BARU) {
      const { data: rs } = await supabase
        .from('faskes')
        .select('id, nama, jenis, kabupaten_id')
        .eq('id', d.rumahSakitId ?? '')
        .maybeSingle()
      if (!rs || rs.jenis !== 'rumah_sakit') {
        return { ok: false, pesan: 'Rumah sakit tidak ditemukan. Muat ulang halaman lalu pilih kembali.', galatMedan: { rumahSakitId: 'Tidak ditemukan' } }
      }
      faskesId = rs.id
      kabupatenId = rs.kabupaten_id ?? d.kabupatenId ?? ''
      namaTempat = rs.nama
    } else {
      namaManualFaskes = (d.namaRsBaru ?? '').trim()
      kabupatenId = d.kabupatenId ?? ''
      namaTempat = namaManualFaskes
    }
  } else {
    const { data: pkm } = await supabase
      .from('puskesmas')
      .select('id, nama, kabupaten_id')
      .eq('id', d.puskesmasId ?? '')
      .maybeSingle()
    if (!pkm) {
      return { ok: false, pesan: 'Puskesmas tidak ditemukan. Muat ulang halaman lalu pilih kembali.', galatMedan: { puskesmasId: 'Tidak ditemukan' } }
    }
    puskesmasId = pkm.id
    faskesId = pkm.id
    kabupatenId = pkm.kabupaten_id ?? ''
    namaTempat = `Puskesmas ${pkm.nama}`

    if (d.peran === 'kader') {
      if (d.posyanduId === POSYANDU_BARU) {
        namaManualPosyandu = (d.namaPosyanduBaru ?? '').trim()
        namaTempat = `Posyandu ${namaManualPosyandu}`
      } else {
        const { data: pos } = await supabase
          .from('posyandu')
          .select('id, nama, puskesmas_id')
          .eq('id', d.posyanduId ?? '')
          .maybeSingle()
        if (!pos || pos.puskesmas_id !== puskesmasId) {
          return { ok: false, pesan: 'Posyandu tidak berada di bawah puskesmas yang dipilih.', galatMedan: { posyanduId: 'Tidak sesuai puskesmas' } }
        }
        posyanduId = pos.id
        namaTempat = `Posyandu ${pos.nama}`
      }
    }
  }

  const { data: dibuat, error: galatBuat } = await authAdmin.createUser({
    email: d.email,
    password: d.sandiSementara,
    email_confirm: true,
    app_metadata: { wajib_ganti_sandi: true },
    user_metadata: {
      nama_lengkap: d.namaLengkap,
      role: d.peran,
      no_hp: d.noHp ? normalkanNoHp(d.noHp) : '',
      no_str: d.peran === 'kader' ? '' : (d.noStr ?? '').trim(),
      kabupaten_id: kabupatenId,
      puskesmas_id: puskesmasId,
      posyandu_id: posyanduId,
      faskes_id: faskesId,
      jenis_faskes: d.peran === 'dokter_spesialis_anak' ? 'rumah_sakit' : 'puskesmas',
      faskes_manual: namaManualFaskes,
      posyandu_manual: namaManualPosyandu,
      dibuat_oleh_admin: true,
    },
  })

  if (galatBuat || !dibuat?.user) {
    const pesan = (galatBuat?.message ?? '').toLowerCase()
    console.error('[admin tambah pengguna] createUser gagal', { pesan: galatBuat?.message })
    if (pesan.includes('already') || pesan.includes('exists')) {
      return {
        ok: false,
        pesan: 'Email ini sudah terdaftar. Cari akunnya di daftar pengguna.',
        galatMedan: { email: 'Email sudah terdaftar' },
      }
    }
    if (pesan.includes('database error')) {
      return {
        ok: false,
        pesan: 'Profil tidak dapat dibuat oleh database. Periksa kembali wilayah yang dipilih.',
      }
    }
    return { ok: false, pesan: 'Akun tidak dapat dibuat. Coba lagi beberapa saat lagi.' }
  }

  const { error: galatSah } = await supabase.rpc('verifikasi_pengguna', {
    p_pengguna_id: dibuat.user.id,
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
      `Akun ${LABEL_PERAN[d.peran]} untuk ${d.namaLengkap} sudah aktif (${namaTempat}). ` +
      'Sampaikan email dan kata sandi sementara; pengguna wajib menggantinya saat masuk pertama kali.',
  }
}
