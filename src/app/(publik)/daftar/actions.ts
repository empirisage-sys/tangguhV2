'use server'

/**
 * Tindakan pendaftaran tenaga kesehatan dan kader posyandu.
 *
 * Mengikuti arsitektur registrasi baru:
 * - Seluruh peran, termasuk kader, masuk ke antrean verifikasi admin.
 * - Isian fasilitas / posyandu manual didaftarkan sebagai 'usulan' agar memiliki ID
 *   dan dinormalkan oleh admin ke fasilitas master saat verifikasi.
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { normalkanNoHp, skemaPendaftaran } from '@/lib/validasi/pendaftaran'
import { PUSKESMAS_GORONTALO } from '@/lib/db/wilayah'
import { urlSitus } from '@/lib/supabase/env'

export type HasilTindakan = {
  ok: boolean
  pesan?: string
  galatMedan?: Record<string, string>
}

// Pemetaan statis UUID master dari database
const MAP_PROVINSI_UUID: Record<string, string> = {
  '75': '78169801-ff7f-4329-94f8-b497d16732a4', // Gorontalo
}

const MAP_KABUPATEN_UUID: Record<string, string> = {
  '7501': '598f5ad7-8f9a-4ff6-a7a5-becaa87b6e1a', // Boalemo
  '7502': 'e7c1ef6e-cc1c-4bf5-b254-716554de6daf', // Kab. Gorontalo
  '7503': '3a92d173-efde-4912-8665-1a5b1b34877e', // Pohuwato
  '7504': 'f094272a-9494-4b9b-9efc-e7b31b895f88', // Bone Bolango
  '7505': '8edf477b-5066-453f-b9e8-6e991abc4c54', // Gorontalo Utara
  '7571': '15d83e69-dee0-4430-a8b3-302bcd7a361a', // Kota Gorontalo
}

const MAP_KABUPATEN_DEFAULT_PUSKESMAS: Record<string, string> = {
  '7501': '2c08601b-cc6b-4b9c-89e4-af9890432516', // Boalemo - Puskesmas Mananggu
  '7502': '587772e0-54f2-4905-80af-094208959563', // Kab. Gorontalo - Puskesmas Batudaa Pantai
  '7503': '510f3489-9d24-4f46-be8e-75419f827d52', // Pohuwato - Puskesmas Popayato
  '7504': 'f4b73597-f1ca-4e63-a5e3-4aad7d512382', // Bone Bolango - Puskesmas Tapa
  '7505': '671c6d55-62e9-4364-8daf-4d7b8dbf7b49', // Gorontalo Utara - Puskesmas Atinggola
  '7571': '920c0fa8-7bac-4b78-8b0a-6aaa43806f12', // Kota Gorontalo - Puskesmas Pilolodaa
}

const DEFAULT_PUSKESMAS_UUID = '920c0fa8-7bac-4b78-8b0a-6aaa43806f12'
const DEFAULT_POSYANDU_UUID = '5dd232fc-d677-4728-8b0a-4e6c0f963978'

export async function daftar(formData: FormData): Promise<HasilTindakan> {
  const hasil = skemaPendaftaran.safeParse({
    email: formData.get('email'),
    sandi: formData.get('sandi'),
    ulangiSandi: formData.get('ulangiSandi'),
    namaLengkap: formData.get('namaLengkap'),
    peran: formData.get('peran'),
    noHp: formData.get('noHp'),
    noStr: formData.get('noStr') ?? '',
    provinsiId: formData.get('provinsiId'),
    kabupatenId: formData.get('kabupatenId') ?? '',
    kabupatenManual: formData.get('kabupatenManual') ?? '',
    jenisFaskes: formData.get('jenisFaskes'),
    faskesId: formData.get('faskesId') ?? '',
    faskesManual: formData.get('faskesManual') ?? '',
    posyanduManual: formData.get('posyanduManual') ?? '',
    setujuKetentuan: formData.get('setujuKetentuan') === 'on',
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

  // ---------------------------------------------------------------------
  // Resolusi ID wilayah.
  //
  // Nilai pada peta UUID di atas hanya dipakai sebagai petunjuk awal. Setiap
  // nilai diverifikasi keberadaannya di database sebelum dikirim, karena UUID
  // pada tabel master dibuat dengan `gen_random_uuid()`: begitu database
  // di-reset atau dimigrasikan ulang, UUID lama tidak lagi ada dan pemasukan
  // profil gagal karena pelanggaran foreign key. Bila UUID tidak ditemukan,
  // nilainya dicari ulang berdasarkan kode/nama, dan bila tetap tidak ketemu
  // kolomnya dikosongkan agar pendaftaran tetap bisa berjalan dan dinormalkan
  // admin saat verifikasi.
  // ---------------------------------------------------------------------
  async function idBerlaku(tabel: string, id: string | null | undefined): Promise<string | null> {
    if (!id) return null
    const { data } = await supabase.from(tabel).select('id').eq('id', id).maybeSingle()
    return data?.id ?? null
  }

  const provKode = d.provinsiId?.replace(/^prov-/, '') || '75'
  let provinsiDbId = await idBerlaku('provinsi', MAP_PROVINSI_UUID[provKode])
  if (!provinsiDbId) {
    const { data: provData } = await supabase
      .from('provinsi')
      .select('id')
      .eq('kode', provKode)
      .maybeSingle()
    provinsiDbId = provData?.id ?? null
  }

  const kabKode = d.kabupatenId?.replace(/^kab-/, '') || '7571'
  let kabupatenDbId = await idBerlaku('kabupaten', MAP_KABUPATEN_UUID[kabKode])
  if (!kabupatenDbId) {
    const { data: kabData } = await supabase
      .from('kabupaten')
      .select('id')
      .eq('kode', kabKode)
      .maybeSingle()
    kabupatenDbId = kabData?.id ?? null
  }

  // Cari Puskesmas / Faskes yang sesuai di DB
  let puskesmasDbId: string | null = null

  if (d.jenisFaskes === 'puskesmas' && d.faskesId && d.faskesId !== 'lainnya') {
    const pusObj = PUSKESMAS_GORONTALO.find((p) => p.id === d.faskesId)
    if (pusObj) {
      const { data: pkmData } = await supabase
        .from('puskesmas')
        .select('id')
        .ilike('nama', `%${pusObj.nama}%`)
        .limit(1)
        .maybeSingle()
      puskesmasDbId = pkmData?.id ?? null
    }
  }

  // Rumah sakit, faskes usulan manual, atau pencarian di atas tidak menemukan apa pun.
  if (!puskesmasDbId) {
    puskesmasDbId = await idBerlaku('puskesmas', MAP_KABUPATEN_DEFAULT_PUSKESMAS[kabKode])
  }
  if (!puskesmasDbId) {
    puskesmasDbId = await idBerlaku('puskesmas', DEFAULT_PUSKESMAS_UUID)
  }
  if (!puskesmasDbId) {
    // Ambil puskesmas mana pun yang ada agar profil tetap punya rujukan yang sah.
    const { data: pkmAda } = await supabase.from('puskesmas').select('id').limit(1).maybeSingle()
    puskesmasDbId = pkmAda?.id ?? null
  }

  // Cari Posyandu yang sesuai di DB untuk kader
  let posyanduDbId: string | null = null
  if (d.peran === 'kader') {
    posyanduDbId = await idBerlaku('posyandu', DEFAULT_POSYANDU_UUID)
    if (!posyanduDbId) {
      const { data: posAda } = await supabase
        .from('posyandu')
        .select('id')
        .eq('puskesmas_id', puskesmasDbId ?? '')
        .limit(1)
        .maybeSingle()
      posyanduDbId = posAda?.id ?? null
    }
  }

  const siteUrl = urlSitus()

  const { error } = await supabase.auth.signUp({
    email: d.email,
    password: d.sandi,
    options: {
      data: {
        nama_lengkap: d.namaLengkap,
        role: d.peran,
        no_hp: normalkanNoHp(d.noHp),
        no_str: (d.noStr ?? '').trim(),
        provinsi_id: provinsiDbId,
        kabupaten_id: kabupatenDbId,
        puskesmas_id: puskesmasDbId || '',
        posyandu_id: posyanduDbId || '',
        faskes_id: puskesmasDbId || '',
        jenis_faskes: d.jenisFaskes,
        kabupaten_manual: d.kabupatenManual?.trim() || '',
        faskes_manual: d.faskesManual?.trim() || '',
        posyandu_manual: d.posyanduManual?.trim() || '',
      },
      emailRedirectTo: `${siteUrl}/auth/konfirmasi`,
    },
  })

  if (error) {
    // Penyebab asli SELALU dicatat di log server (Vercel > Logs). Tanpa ini,
    // setiap galat yang tidak dikenali menjadi tidak dapat didiagnosis.
    console.error('[daftar] signUp gagal', {
      pesan: error.message,
      status: (error as { status?: number }).status,
      kode: (error as { code?: string }).code,
      peran: d.peran,
      jenisFaskes: d.jenisFaskes,
      provinsiDbId,
      kabupatenDbId,
      puskesmasDbId,
      posyanduDbId,
    })

    const pesan = error.message.toLowerCase()

    if (pesan.includes('already registered') || pesan.includes('already been registered')) {
      return {
        ok: false,
        pesan: 'Alamat email ini sudah terdaftar. Coba masuk, atau pakai menu lupa kata sandi.',
        galatMedan: { email: 'Email sudah terdaftar' },
      }
    }
    if (pesan.includes('rate limit') || pesan.includes('too many')) {
      return { ok: false, pesan: 'Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.' }
    }
    if (pesan.includes('signups not allowed') || pesan.includes('signup is disabled')) {
      return {
        ok: false,
        pesan:
          'Pendaftaran mandiri sedang dinonaktifkan pada sistem. Hubungi admin untuk mengaktifkannya.',
      }
    }
    if (pesan.includes('sending confirmation email') || pesan.includes('error sending')) {
      return {
        ok: false,
        pesan:
          'Akun tidak dapat dibuat karena surel konfirmasi gagal dikirim. Hubungi admin untuk memeriksa pengaturan surel.',
      }
    }
    if (pesan.includes('database error') || pesan.includes('unexpected_failure')) {
      return {
        ok: false,
        pesan:
          'Data wilayah atau fasilitas Anda belum lengkap di basis data. Hubungi admin dan sebutkan Puskesmas serta kabupaten tempat Anda bertugas.',
      }
    }
    if (pesan.includes('password')) {
      return {
        ok: false,
        pesan: 'Kata sandi belum memenuhi syarat sistem.',
        galatMedan: { sandi: error.message },
      }
    }
    if (pesan.includes('invalid') && pesan.includes('email')) {
      return {
        ok: false,
        pesan: 'Alamat email tidak diterima sistem.',
        galatMedan: { email: 'Alamat email tidak valid' },
      }
    }

    return {
      ok: false,
      pesan: `Pendaftaran belum berhasil: ${error.message}. Bila berulang, hubungi admin dengan menyebutkan pesan ini.`,
    }
  }

  // Seluruh peran menunggu verifikasi admin
  redirect('/menunggu-verifikasi?baru=1')
}
