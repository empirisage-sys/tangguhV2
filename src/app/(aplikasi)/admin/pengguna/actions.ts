'use server'

/**
 * Tindakan Server untuk Manajemen Pengguna oleh Administrator:
 * - Edit data akun & hak akses
 * - Hapus akun pengguna secara permanen (dengan pengamanan)
 * - Reset kata sandi manual langsung oleh Administrator
 */
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { wajibPeran, TidakBerwenangError } from '@/lib/supabase/penjaga'
import {
  normalkanNoHp,
  skemaEditPenggunaAdmin,
  skemaResetSandiAdmin,
  RS_BARU,
} from '@/lib/validasi/pendaftaran'
import type { HasilTindakan } from '@/app/(publik)/daftar/actions'

/**
 * Menerjemahkan nama batasan Postgres menjadi kalimat yang dapat
 * ditindaklanjuti administrator.
 *
 * Lapisan validasi Zod sudah mencerminkan seluruh batasan ini, sehingga
 * secara wajar tidak ada yang sampai ke sini. Peta ini adalah jaring
 * terakhir: bila suatu hari sebuah batasan berubah di database tanpa
 * cerminnya ikut diperbarui, administrator tetap menerima kalimat, bukan
 * pesan mentah seperti 'new row for relation "profiles" violates check
 * constraint "chk_spesialis_anak_di_rs"'.
 */
const PESAN_BATASAN: Record<string, string> = {
  chk_spesialis_anak_di_rs:
    'Dokter spesialis anak hanya dapat tercatat bertugas di rumah sakit.',
  chk_spesialis_anak_wajib_faskes:
    'Dokter spesialis anak wajib mencantumkan rumah sakit tempat bertugas.',
  chk_kader_wajib_posyandu: 'Kader wajib mencantumkan posyandu.',
  chk_nakes_wajib_puskesmas:
    'Dokter umum dan dietisien wajib mencantumkan puskesmas.',
  chk_str_nakes: 'Nomor STR wajib diisi minimal 5 karakter untuk peran ini.',
  chk_tolak_wajib_beralasan:
    'Penolakan wajib disertai alasan minimal 10 karakter.',
  chk_keputusan_tercatat:
    'Perubahan status akun gagal dicatat. Muat ulang halaman lalu coba lagi.',
}

function pesanGalatDb(pesanAsli: string): string {
  for (const [nama, kalimat] of Object.entries(PESAN_BATASAN)) {
    if (pesanAsli.includes(nama)) return kalimat
  }
  if (pesanAsli.includes('violates foreign key constraint')) {
    return 'Wilayah atau fasilitas yang dipilih tidak ditemukan di data induk. Muat ulang halaman lalu pilih kembali.'
  }
  return 'Perubahan tidak dapat disimpan. Periksa kembali isian wilayah dan peran.'
}

export async function adminEditPengguna(formData: FormData): Promise<HasilTindakan> {
  let profilAdmin
  try {
    profilAdmin = await wajibPeran(['admin'])
  } catch (galat) {
    if (galat instanceof TidakBerwenangError) return { ok: false, pesan: galat.message }
    throw galat
  }

  const hasil = skemaEditPenggunaAdmin.safeParse({
    penggunaId: formData.get('penggunaId'),
    namaLengkap: formData.get('namaLengkap'),
    role: formData.get('role'),
    statusAkun: formData.get('statusAkun'),
    noHp: formData.get('noHp') ?? '',
    noStr: formData.get('noStr') ?? '',
    jenisFaskes: formData.get('jenisFaskes') ?? '',
    puskesmasId: formData.get('puskesmasId') ?? '',
    rumahSakitId: formData.get('rumahSakitId') ?? '',
    namaRsBaru: formData.get('namaRsBaru') ?? '',
    posyanduId: formData.get('posyanduId') ?? '',
    alasanTolak: formData.get('alasanTolak') ?? '',
  })

  if (!hasil.success) {
    const galatMedan: Record<string, string> = {}
    for (const isu of hasil.error.issues) {
      const medan = String(isu.path[0] ?? 'umum')
      galatMedan[medan] ??= isu.message
    }
    return {
      ok: false,
      pesan: hasil.error.issues[0]?.message ?? 'Data yang dimasukkan tidak valid.',
      galatMedan,
    }
  }

  const d = hasil.data

  // ==========================================================================
  // PENGAMAN PENURUNAN PERAN DIRI SENDIRI
  //
  // `adminHapusPengguna` sudah lama mencegah admin menghapus akunnya sendiri,
  // tetapi tindakan ini tidak pernah memeriksa hal yang setara. Seorang
  // administrator yang mengubah perannya sendiri menjadi bukan-admin akan
  // langsung kehilangan seluruh akses ke /admin/*, dan karena sistem ini hanya
  // memiliki satu administrator, pemulihannya menuntut SQL langsung ke
  // database. Kerugiannya besar dan tidak dapat dibatalkan dari dalam aplikasi.
  // ==========================================================================
  if (d.penggunaId === profilAdmin.id && d.role !== 'admin') {
    return {
      ok: false,
      pesan:
        'Anda tidak dapat mengubah peran akun Administrator Anda sendiri. ' +
        'Mintalah administrator lain melakukannya, agar sistem tidak kehilangan ' +
        'seluruh akses administratifnya.',
    }
  }
  if (d.penggunaId === profilAdmin.id && d.statusAkun !== 'disetujui') {
    return {
      ok: false,
      pesan:
        'Anda tidak dapat menonaktifkan akun Administrator Anda sendiri yang sedang digunakan.',
    }
  }

  const supabase = await createClient()

  // Pastikan sasarannya benar-benar ada. Tanpa ini, `update ... eq('id', ...)`
  // pada id yang tidak ada tidak menghasilkan galat apa pun, sehingga
  // administrator menerima pesan "berhasil diperbarui" atas sesuatu yang
  // tidak pernah tersentuh.
  const { data: sasaran, error: galatBaca } = await supabase
    .from('profiles')
    .select('id, status_akun, disetujui_oleh, disetujui_pada')
    .eq('id', d.penggunaId)
    .maybeSingle()

  if (galatBaca) {
    return { ok: false, pesan: pesanGalatDb(galatBaca.message) }
  }
  if (!sasaran) {
    return {
      ok: false,
      pesan: 'Akun yang hendak diubah tidak ditemukan. Muat ulang halaman ini.',
    }
  }

  // ==========================================================================
  // FASILITAS TEMPAT BERTUGAS
  //
  // `puskesmas_id` dan `faskes_id` menunjuk dua tabel yang BERBEDA, dan dua
  // bagian sistem membacanya secara berbeda pula: `my_puskesmas_id()` di
  // Postgres membaca `puskesmas_id` saja. Karena itu `faskes_id` sebuah rumah
  // sakit TIDAK boleh dituliskan ke `puskesmas_id`; selain melanggar kunci
  // asing ke tabel `puskesmas`, hal itu membuat cakupan RLS tidak dapat
  // dinilai.
  // ==========================================================================
  let faskesId: string | null = null
  const puskesmasId = d.puskesmasId ?? null

  if (d.jenisFaskes === 'puskesmas') {
    // Baris `faskes` untuk puskesmas memakai id yang sama dengan barisnya di
    // tabel `puskesmas` (lihat migrasi 20260819160000 dan 20260909000000).
    faskesId = puskesmasId
  } else if (d.jenisFaskes === 'rumah_sakit') {
    if (d.rumahSakitId === RS_BARU) {
      const nama = (d.namaRsBaru ?? '').trim()

      // Pakai rumah sakit yang namanya sudah ada, agar tidak menumpuk duplikat
      // setiap kali administrator mengetik nama yang sama.
      const { data: adaRs } = await supabase
        .from('faskes')
        .select('id')
        .eq('jenis', 'rumah_sakit')
        .ilike('nama', nama)
        .limit(1)
        .maybeSingle()

      if (adaRs?.id) {
        faskesId = adaRs.id as string
      } else {
        const { data: profilSasaran } = await supabase
          .from('profiles')
          .select('kabupaten_id')
          .eq('id', d.penggunaId)
          .maybeSingle()

        const { data: rsBaru, error: galatRs } = await supabase
          .from('faskes')
          .insert({
            nama,
            jenis: 'rumah_sakit',
            status: 'usulan',
            kabupaten_id: (profilSasaran?.kabupaten_id as string | null) ?? null,
            sumber_data: 'ditambahkan_admin',
            perlu_verifikasi: false,
          })
          .select('id')
          .single()

        if (galatRs || !rsBaru) {
          return {
            ok: false,
            pesan: `Rumah sakit "${nama}" gagal ditambahkan. ${pesanGalatDb(galatRs?.message ?? '')}`,
          }
        }
        faskesId = rsBaru.id as string
      }
    } else {
      faskesId = d.rumahSakitId || null
    }
  }

  // Administrator tanpa wilayah: seluruh rujukan wilayah dikosongkan. Cakupan
  // datanya `boleh_akses_balita` -> true tanpa melihat wilayah sama sekali.
  const tanpaWilayah = !d.jenisFaskes

  // Posyandu hanya bermakna bagi kader. Peran lain dikosongkan, supaya profil
  // tidak mengaku bernaung pada posyandu yang tidak dibinanya.
  const posyanduId = d.role === 'kader' ? (d.posyanduId ?? null) : null

  // ==========================================================================
  // chk_keputusan_tercatat: status selain 'menunggu' WAJIB mencatat siapa dan
  // kapan. Tindakan ini dahulu mengubah `status_akun` tanpa menyentuh kedua
  // kolom itu, sehingga menyetujui akun yang masih 'menunggu' dari formulir
  // ini selalu melanggar batasan tersebut.
  // ==========================================================================
  const jejakKeputusan =
    d.statusAkun === 'menunggu'
      ? { disetujui_oleh: null, disetujui_pada: null }
      : {
          disetujui_oleh: (sasaran.disetujui_oleh as string | null) ?? profilAdmin.id,
          disetujui_pada:
            (sasaran.disetujui_pada as string | null) ?? new Date().toISOString(),
        }

  try {
    const { data: terubah, error } = await supabase
      .from('profiles')
      .update({
        nama_lengkap: d.namaLengkap,
        role: d.role as never,
        status_akun: d.statusAkun as never,
        no_hp: d.noHp ? normalkanNoHp(d.noHp) : null,
        no_str: d.noStr ? d.noStr.trim() : null,
        jenis_faskes: tanpaWilayah ? null : (d.jenisFaskes as never),
        puskesmas_id: tanpaWilayah ? null : puskesmasId,
        faskes_id: tanpaWilayah ? null : faskesId,
        posyandu_id: tanpaWilayah ? null : posyanduId,
        alasan_tolak:
          d.statusAkun === 'ditolak' ? (d.alasanTolak ?? '').trim() : null,
        ...jejakKeputusan,
        updated_at: new Date().toISOString(),
      })
      .eq('id', d.penggunaId)
      .select('id')

    if (error) {
      console.warn('Gagal update profile oleh admin:', error)
      return { ok: false, pesan: pesanGalatDb(error.message) }
    }

    // Policy RLS dapat menyaring baris tanpa memunculkan galat. Tanpa
    // pemeriksaan ini, penyaringan itu tampak sebagai keberhasilan.
    if (!terubah || terubah.length === 0) {
      return {
        ok: false,
        pesan:
          'Perubahan tidak tersimpan karena baris akun tidak terjangkau. ' +
          'Pastikan Anda masih masuk sebagai administrator, lalu coba lagi.',
      }
    }
  } catch (err) {
    console.error('Error adminEditPengguna:', err)
    return {
      ok: false,
      pesan: 'Terjadi kesalahan sistem saat memperbarui data.',
    }
  }

  revalidatePath('/admin/pengguna')
  revalidatePath('/admin/verifikasi')
  return {
    ok: true,
    pesan: `Data akun "${d.namaLengkap}" berhasil diperbarui.`,
  }
}

export async function adminHapusPengguna(penggunaId: string): Promise<HasilTindakan> {
  try {
    await wajibPeran(['admin'])
  } catch (galat) {
    if (galat instanceof TidakBerwenangError) return { ok: false, pesan: galat.message }
    throw galat
  }

  if (!penggunaId) {
    return { ok: false, pesan: 'ID pengguna tidak valid.' }
  }

  const supabase = await createClient()

  // Cegah admin menghapus akunnya sendiri
  const { data: userAuth } = await supabase.auth.getUser()
  if (userAuth?.user?.id === penggunaId) {
    return {
      ok: false,
      pesan: 'Anda tidak dapat menghapus akun Administrator Anda sendiri yang sedang aktif digunakan.',
    }
  }

  try {
    // Hapus data profil
    const { error: errProfil } = await supabase
      .from('profiles')
      .delete()
      .eq('id', penggunaId)

    if (errProfil) {
      console.warn('Gagal hapus profil:', errProfil)
      return { ok: false, pesan: `Gagal menghapus data akun: ${errProfil.message}` }
    }

    // Jika service role key tersedia di server environment, hapus juga akun otentikasi auth.users
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (serviceKey && process.env.NEXT_PUBLIC_SUPABASE_URL) {
      try {
        const adminAuth = createSupabaseClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          serviceKey,
          { auth: { autoRefreshToken: false, persistSession: false } }
        )
        await adminAuth.auth.admin.deleteUser(penggunaId)
      } catch (authDelErr) {
        console.warn('Hapus auth user fallback warning:', authDelErr)
      }
    }
  } catch (err: any) {
    console.error('Error adminHapusPengguna:', err)
    return { ok: false, pesan: err.message || 'Terjadi kesalahan sistem saat menghapus akun.' }
  }

  revalidatePath('/admin/pengguna')
  revalidatePath('/admin/verifikasi')
  return {
    ok: true,
    pesan: 'Akun pengguna berhasil dihapus secara permanen dari sistem.',
  }
}

export async function adminResetPasswordManual(
  penggunaId: string,
  sandiBaru: string,
): Promise<HasilTindakan> {
  try {
    await wajibPeran(['admin'])
  } catch (galat) {
    if (galat instanceof TidakBerwenangError) return { ok: false, pesan: galat.message }
    throw galat
  }

  const hasil = skemaResetSandiAdmin.safeParse({
    penggunaId,
    sandiBaru,
  })

  if (!hasil.success) {
    return {
      ok: false,
      pesan: hasil.error.issues[0]?.message ?? 'Kata sandi baru minimal 8 karakter.',
    }
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!serviceKey || !supabaseUrl) {
    return {
      ok: false,
      pesan: 'Konfigurasi kunci server belum tersedia untuk reset password instan. Silakan gunakan alur Lupa Sandi atau hubungi teknisi database.',
    }
  }

  try {
    const adminAuth = createSupabaseClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { error } = await adminAuth.auth.admin.updateUserById(penggunaId, {
      password: hasil.data.sandiBaru,
    })

    if (error) {
      console.warn('Gagal reset password user by admin:', error)
      return { ok: false, pesan: `Gagal mereset kata sandi: ${error.message}` }
    }
  } catch (err: any) {
    console.error('Error adminResetPasswordManual:', err)
    return { ok: false, pesan: err.message || 'Terjadi kesalahan saat mengatur kata sandi baru.' }
  }

  revalidatePath('/admin/pengguna')
  return {
    ok: true,
    pesan: 'Kata sandi pengguna berhasil diatur ulang. Pengguna dapat langsung masuk dengan kata sandi baru tersebut.',
  }
}
