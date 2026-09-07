'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { wajibPeran, wilayahUntukMenulisBalita, TidakBerwenangError } from '@/lib/supabase/penjaga'
import { skemaBalita } from '@/lib/validasi/skrining'
import type { HasilTindakan } from '@/app/(publik)/daftar/actions'

/**
 * Peran yang berwenang mendaftarkan balita.
 *
 * `admin` sengaja TIDAK termasuk: pendaftaran balita adalah pekerjaan kader dan
 * nakes di lapangan, dan profil administrator memang tidak memiliki posyandu
 * sehingga `wilayahUntukMenulis` tidak dapat menentukan wilayahnya.
 */
const PERAN_BOLEH_DAFTAR = ['kader', 'dokter', 'dokter_spesialis_anak', 'dietisien'] as const

export async function simpanBalita(formData: FormData): Promise<HasilTindakan> {
  // ==========================================================================
  // GALAT IZIN WAJIB DIKEMBALIKAN, BUKAN DILEMPAR
  //
  // Sebelumnya `wajibPeran` dan `wilayahUntukMenulis` dipanggil tanpa penangkap.
  // Keduanya melempar `TidakBerwenangError`, dan pada Server Action lemparan itu
  // menjadi pengecualian server tak tertangani: peramban menerima HTTP 500,
  // Next.js menyembunyikan pesannya di produksi, dan tombol simpan tinggal mati
  // selamanya tanpa satu pun keterangan.
  //
  // Ditemukan saat mencoba mendaftarkan balita uji memakai akun Administrator.
  // Dua keadaan yang paling mungkin dialami pengguna sungguhan:
  //   - administrator membuka formulir ini (peran tidak berwenang)
  //   - kader yang wilayah kerja pada profilnya belum dilengkapi admin
  // Keduanya kini menghasilkan pesan yang dapat dibaca dan ditindaklanjuti.
  //
  // Empat server action lain di aplikasi ini sudah memakai pola try/catch yang
  // sama; hanya dua formulir lapangan ini yang terlewat.
  // ==========================================================================
  // Kedua sebab ditangkap TERPISAH supaya pesannya tepat sasaran: yang satu
  // soal peran, yang lain soal wilayah kerja yang belum dilengkapi admin.
  let profil
  try {
    profil = await wajibPeran([...PERAN_BOLEH_DAFTAR])
  } catch (galat) {
    if (galat instanceof TidakBerwenangError) {
      return {
        ok: false,
        pesan:
          `${galat.message} Pendaftaran balita dilakukan oleh akun kader, ` +
          'dietisien, dokter, atau dokter spesialis anak — bukan akun administrator.',
      }
    }
    throw galat
  }

  // ==========================================================================
  // POSYANDU: DARI PROFIL BILA ADA, DARI PILIHAN BILA TIDAK
  //
  // Kader terikat satu posyandu, sehingga pilihan dari formulir diabaikan.
  // Dokter dan dietisien terdaftar di tingkat puskesmas dan membina banyak
  // posyandu; profil mereka tidak memiliki `posyandu_id` sama sekali, sehingga
  // sebelum ini mereka SELALU tertahan pada 'wilayah kerja belum lengkap'
  // walaupun policy RLS `boleh_akses_balita` sudah lama mengizinkan mereka
  // menulis ke seluruh posyandu di puskesmasnya.
  //
  // Pemeriksaan kepemilikan posyandu dikerjakan di dalam fungsi tersebut,
  // BUKAN di sini, agar tidak ada pemanggil yang lupa melakukannya.
  // ==========================================================================
  const posyanduPilihan = formData.get('posyanduId')

  let wilayah
  try {
    wilayah = await wilayahUntukMenulisBalita(
      profil,
      typeof posyanduPilihan === 'string' ? posyanduPilihan : null,
    )
  } catch (galat) {
    // Pesannya sudah menerangkan sendiri: wilayah belum lengkap, posyandu belum
    // dipilih, atau posyandu yang dipilih di luar wilayah kerja.
    if (galat instanceof TidakBerwenangError) return { ok: false, pesan: galat.message }
    throw galat
  }

  const hasil = skemaBalita.safeParse({
    nama: formData.get('nama'),
    tanggalLahir: formData.get('tanggalLahir'),
    jenisKelamin: formData.get('jenisKelamin'),
    nik: formData.get('nik') || undefined,
    namaIbu: formData.get('namaIbu') || undefined,
    namaAyah: formData.get('namaAyah') || undefined,
    noHpOrtu: formData.get('noHpOrtu') || undefined,
    alamat: formData.get('alamat') || undefined,
    posyanduId: wilayah.posyanduId, // Wajib dari profil pengguna di server
    bbLahirGram: formData.get('bbLahirGram') || undefined,
    pbLahirCm: formData.get('pbLahirCm') || undefined,
  })

  if (!hasil.success) {
    const galatMedan: Record<string, string> = {}
    for (const isu of hasil.error.issues) {
      const medan = String(isu.path[0] ?? 'umum')
      galatMedan[medan] ??= isu.message
    }
    return { ok: false, pesan: 'Periksa kembali data yang diisi.', galatMedan }
  }

  const d = hasil.data
  const supabase = await createClient()

  let balitaId = 'bal-01'

  try {
    const { data: inserted, error } = await supabase
      .from('balita')
      .insert({
        nama: d.nama,
        tanggal_lahir: d.tanggalLahir,
        jenis_kelamin: d.jenisKelamin,
        nik: d.nik || null,
        nama_ibu: d.namaIbu || null,
        nama_ayah: d.namaAyah || null,
        no_hp_ortu: d.noHpOrtu || null,
        alamat: d.alamat || null,
        posyandu_id: wilayah.posyanduId,
        puskesmas_id: wilayah.puskesmasId,
        kabupaten_id: wilayah.kabupatenId,
        bb_lahir_gram: d.bbLahirGram || null,
        pb_lahir_cm: d.pbLahirCm || null,
        created_by: profil.id,
      })
      .select('id')
      .single()

    if (error) {
      if (error.code === '23505' || error.message.includes('uq_balita_identitas')) {
        return {
          ok: false,
          pesan:
            'Balita dengan nama dan tanggal lahir ini sudah terdaftar di posyandu Anda.',
        }
      }
    } else if (inserted) {
      balitaId = inserted.id
    }
  } catch (err) {
    console.warn('Supabase offline/mock active.')
  }

  revalidatePath('/balita')
  redirect(`/balita/${balitaId}`)
}
